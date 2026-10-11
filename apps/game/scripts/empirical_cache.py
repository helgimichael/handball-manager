"""Polite public-page cache. Livewire calls only follow rendered infinite-scroll controls."""
import hashlib,json,time,re,urllib.request,urllib.error,urllib.robotparser,http.cookiejar
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlparse
from empirical_html import Document

class Cache:
    def __init__(self,directory,delay=1):
        self.path=Path(directory);self.path.mkdir(parents=True,exist_ok=True)
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.delay=delay;self.last=0;self.policies={};self.manifest=[];self.blocked={}
    def request(self,url,payload=None,force=False):
        host=urlparse(url).netloc
        if host not in {'www.profixio.com','handballstats.se','handbollsligan.se','www.svenskhandboll.se'}:raise ValueError('Source host not approved')
        if host in self.blocked:raise self.blocked[host]
        if host not in self.policies and not url.endswith('/robots.txt'):
            try:
                raw=self.request('https://'+host+'/robots.txt');rp=urllib.robotparser.RobotFileParser();rp.parse(raw.decode('utf-8').splitlines());self.policies[host]=rp
            except urllib.error.HTTPError as e:
                if e.code!=404:raise
                self.policies[host]=None
        policy=self.policies.get(host)
        if policy and not policy.can_fetch('HandballManagerResearch',url):raise ValueError('Robots policy disallows '+url)
        identity=url+(json.dumps(payload,sort_keys=True)if payload else '')
        key=hashlib.sha256(identity.encode()).hexdigest();body=self.path/(key+'.body');meta=self.path/(key+'.json');negative=self.path/(key+'.error.json')
        if negative.exists()and not force:
            record=json.loads(negative.read_text())
            if (datetime.now(timezone.utc)-datetime.fromisoformat(record['retrievedAt'])).total_seconds()<86400:raise urllib.error.HTTPError(url,record['status'],'Cached public-source HTTP error',None,None)
        if body.exists() and not force:
            record=json.loads(meta.read_text());self.manifest.append(record);return body.read_bytes()
        time.sleep(max(0,self.delay-(time.monotonic()-self.last)))
        headers={'User-Agent':'HandballManagerResearch/1.0 (public competition statistics; cached offline research)','Accept':'text/html,application/json,application/pdf,*/*;q=0.5'}
        data=None
        if payload:
            data=json.dumps(payload).encode();headers.update({'Content-Type':'application/json','X-Livewire':'true'})
        req=urllib.request.Request(url,data=data,headers=headers)
        self.last=time.monotonic()
        try:
            with self.opener.open(req,timeout=45)as response:
                raw=response.read();status=response.status;content_type=response.headers.get('Content-Type','')
        except urllib.error.HTTPError as error:
            if error.code in {401,403,429}:self.blocked[host]=error
            if error.code==404:negative.write_text(json.dumps({'url':url,'status':404,'retrievedAt':datetime.now(timezone.utc).isoformat()}))
            raise
        record={'url':url,'retrievedAt':datetime.now(timezone.utc).isoformat(),'method':'POST public infinite-scroll'if payload else'GET','sha256':hashlib.sha256(raw).hexdigest(),'contentType':content_type,'status':status,'cacheKey':key}
        body.write_bytes(raw);meta.write_text(json.dumps(record,indent=2));self.manifest.append(record);return raw
    def html(self,url):return self.request(url).decode('utf-8-sig')
    def pages(self,url):
        text=self.html(url);yield text
        endpoint=re.search(r'data-update-uri="([^"]+)"',text)
        endpoint=endpoint.group(1)if endpoint else'https://www.profixio.com/app/livewire/update'
        if endpoint.startswith('/'):endpoint='https://www.profixio.com'+endpoint
        token=re.search(r'<meta name="csrf-token" content="([^"]+)"',text).group(1)
        for _ in range(100):
            nodes=Document(text).root.find(lambda n:n.attrs.get('wire:name')=='infinite-scroll-next-page' and '__lazyLoad'in(n.attrs.get('x-intersect')or''))
            if not nodes:return
            n=nodes[0];argument=re.search(r"__lazyLoad\('([^']+)'",n.attrs['x-intersect']).group(1)
            snapshot=n.attrs['wire:snapshot']
            response=json.loads(self.request(endpoint,{'_token':token,'components':[{'snapshot':snapshot,'updates':{},'calls':[{'path':'','method':'__lazyLoad','params':[argument]}]}]}))
            htmls=[c.get('effects',{}).get('html','')for c in response['components']]
            text='\n'.join(htmls)
            if not text:raise ValueError('Empty public pagination response')
            yield text
        raise ValueError('Pagination limit reached')
