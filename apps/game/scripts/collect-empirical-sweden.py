"""Official 2025/26 regular-season sources. Run from repository root.
Network is confined to this offline collector; normalized JSON powers all tests/builds.
"""
import argparse,json,re,io,hashlib,urllib.error
from pathlib import Path
from datetime import datetime,timezone
from empirical_html import Document
from empirical_cache import Cache

PARSER='sweden-public/1.1.0'
COMPETITIONS=[('swe-2','Herrallsvenskan',17956,'men-senior',182),('swe-1','Handbollsligan Herr',17951,'men-senior',182),('swe-w-1','Handbollsligan Dam',17958,'women-senior',132),('swe-w-2','Damallsvenskan',17959,'women-senior',132)]

def schedule(text,competition):
    root=Document(text).root;rows=[]
    for node in root.find(lambda n:re.fullmatch(r'mc_mini_\d+',n.attrs.get('wire:key')or'')is not None):
        teamlinks=node.find(lambda n:n.tag=='a' and '/teams/'in(n.attrs.get('href')or''))
        if len(teamlinks)!=2:raise ValueError('Schedule team links missing')
        init=node.attrs['x-init'];h=re.search(r"homegoals: '([0-9]+)'",init);a=re.search(r"awaygoals: '([0-9]+)'",init)
        if not h or not a:raise ValueError('Played match lacks score')
        # Grundserie round cards explicitly contain Omgång, not quarter/semi/final.
        text=node.text();regular=bool(re.search(r'Omg.ng\s+\d+',text))
        rows.append({'sourceMatchId':node.attrs['wire:key'].split('_')[-1],'competition':competition,'season':'2025-26','stage':'REGULAR_SEASON'if regular else'OTHER_STAGE',
            'home':{'sourceTeamId':teamlinks[0].attrs['href'].split('/')[-1],'sourceName':teamlinks[0].text()},'away':{'sourceTeamId':teamlinks[1].attrs['href'].split('/')[-1],'sourceName':teamlinks[1].text()},'homeGoals':int(h.group(1)),'awayGoals':int(a.group(1))})
    return rows

def match_data(text):
    root=Document(text).root
    nodes=root.find(lambda n:(n.attrs.get('x-data')or'').startswith('matchLive(JSON.parse('))
    if len(nodes)!=1:raise ValueError('Published match JSON missing')
    literal=re.fullmatch(r"matchLive\(JSON.parse\('(.*)'\)\)",nodes[0].attrs['x-data'],re.S).group(1)
    return json.loads(json.loads('"'+literal.replace('"','\\"')+'"'))

def protocol(data,match):
    if str(data['kampId'])!=match['sourceMatchId'] or data['state']!='full_time':raise ValueError('Protocol identity/completion mismatch')
    if str(data['homeWebid'])!=match['home']['sourceTeamId'] or str(data['awayWebid'])!=match['away']['sourceTeamId']:raise ValueError('Protocol teams mismatch')
    events=data['events'];seen=set();players={};stats={s:{'sevenMetres':0,'sevenMetreGoals':0,'suspensions':0,'redCards':0}for s in ['home','away']}
    for e in events:
        if e['id']in seen:raise ValueError('Duplicate protocol event')
        seen.add(e['id']);side=e['side']
        if side not in stats:continue
        if e.get('isGoal') and e.get('pointForOtherTeam'):raise ValueError('Own-goal protocol needs manual review')
        key=(side,str(e.get('playerId')))
        if e.get('playerId')is not None:
            players.setdefault(key,{'sourcePlayerId':str(e['playerId']),'sourceName':e['playerName'],'side':side,'goals':0,'sevenMetres':0,'sevenMetreGoals':0,'suspensions':0,'position':None,'identityStatus':'SOURCE_ID_ONLY'})
        if e.get('isGoal'):
            if key not in players:raise ValueError('Unattributed goal')
            players[key]['goals']+=int(e.get('goals',1))
        attempted=e.get('isPenalty')and e.get('isGoal')or e.get('name')=='7-m miss'
        if attempted:
            stats[side]['sevenMetres']+=1;stats[side]['sevenMetreGoals']+=int(bool(e.get('isGoal')))
            if key in players:players[key]['sevenMetres']+=1;players[key]['sevenMetreGoals']+=int(bool(e.get('isGoal')))
        if e.get('isExpulsion'):
            minutes=e.get('expulsionMinutes',0)
            if minutes%2 or minutes<0:raise ValueError('Unexpected suspension duration')
            stats[side]['suspensions']+=minutes//2
            if key in players:players[key]['suspensions']+=minutes//2
        stats[side]['redCards']+=int(bool(e.get('isRed')))
    for side in ['home','away']:
        total=sum(p['goals']for p in players.values()if p['side']==side)
        if total!=match[side+'Goals']:raise ValueError(f'Player goals do not reconcile: {side} {total} != {match[side+"Goals"]}')
    end=[e for e in events if e.get('endsPeriod') and e.get('minute')==60]
    if not end or int(end[0]['scoreH'])!=match['homeGoals']or int(end[0]['scoreA'])!=match['awayGoals']:raise ValueError('Final protocol score mismatch')
    return {'players':list(players.values()),'teamStats':stats,'eventCount':len(events),'evidenceTier':'D','definitions':{'sevenMetres':'made 7m events + explicit 7-m miss events; awards not counted as attempts','suspensions':'sum recorded expulsionMinutes / 2, including double suspensions; includes bench sanctions if recorded'}}

def pdf_stats(raw,match):
    import pdfplumber
    def native_rows(page):
        # Jilsén draws cells separately. Geometric sorting interleaves long names
        # with adjacent numeric cells. Preserve drawing order within each baseline.
        if not isinstance(page.chars,list):return page.extract_text()or''
        baselines={}
        for c in page.chars:baselines.setdefault(round(c['top'],1),[]).append(c)
        lines=[]
        for top,chars in sorted(baselines.items()):
            value='';last=None
            for c in chars:
                if last is not None and (c['x0']-last['x1']>1.5 or c['x0']<last['x0']):value+=' '
                value+=c['text'];last=c
            lines.append(value)
        return '\n'.join(lines)
    with pdfplumber.open(io.BytesIO(raw))as document:text='\n'.join(native_rows(page)for page in document.pages)
    if not re.search(r'\b'+match['sourceMatchId']+r'\s*/\s*202[56]-',text):raise ValueError('PDF match/date identity mismatch')
    score=re.search(r'\s(\d+)\s*-\s*(\d+)\s*\(',text)
    if not score or tuple(map(int,score.groups()))!=(match['homeGoals'],match['awayGoals']):raise ValueError('PDF score mismatch')
    sides=[];section=None;rows=[];issues=[]
    for line in text.splitlines():
        if line.endswith(':') and not line.startswith(('Software','ASST')):
            sides.append(line[:-1]);continue
        if re.match(r'M.lvakt ',line):section='KEEPER';continue
        if line.startswith('Utespelare '):section='FIELD';continue
        if not re.match(r'^\d+ ',line)or section is None or re.match(r'^\d+ /',line):continue
        m=re.fullmatch(r'(\d+) (.+?)\s*(\d+)/(\d+)(?: \(\d+%\))? (\d+)/(\d+)(?: \(\d+%\))? (.+)',line)
        if not m:raise ValueError('Unrecognized PDF player row '+line)
        no,name,n,d,pn,pd,tail=m.groups();values=tail.split()
        if len(values)!=10:raise ValueError('PDF column count mismatch '+line)
        integers=list(map(int,values[:9]));n,d,pn,pd=map(int,[n,d,pn,pd])
        if min(n,d,pn,pd,*integers)<0 or n>d or pn>pd:raise ValueError('Impossible PDF statistics')
        side='home'if len(sides)==1 else'away'if len(sides)==2 else None
        if side is None or section is None:raise ValueError('Unresolved PDF section')
        row={'sourcePlayerId':f"pdf:{match['sourceMatchId']}:{side}:{no}",'sourceName':name,'shirtNumber':no,'side':side,'position':'MV'if section=='KEEPER'else None,'identityStatus':'MATCH_LOCAL_PDF_ID','ordinaryNumerator':n,'ordinaryDenominator':d,'sevenMetreNumerator':pn,'sevenMetreDenominator':pd,'suspensions':integers[8]if section=='KEEPER'else integers[7]}
        if section=='KEEPER':
            row.update({'saves':n+pn,'shotsFaced':d+pd,'goalsConceded':integers[0],'assists':integers[3],'goals':integers[4],'denominatorValid':d+pd==n+pn+integers[0]})
            if not row['denominatorValid']:issues.append({'player':row['sourcePlayerId'],'kind':'KEEPER_DENOMINATOR_MISMATCH','difference':d+pd-n-pn-integers[0]})
        else:row.update({'goals':n+pn,'shots':d+pd,'sevenMetres':pd,'sevenMetreGoals':pn,'assists':integers[0],'passErrors':integers[4],'lostBalls':integers[5],'ruleErrors':integers[6],'redCards':integers[8]})
        rows.append(row)
    if len(sides)!=2 or not rows:raise ValueError('Missing PDF team sections')
    for side in ['home','away']:
        total=sum(r['goals']for r in rows if r['side']==side)
        if total!=match[side+'Goals']:issues.append({'kind':'PDF_PLAYER_GOAL_SUM_MISMATCH','side':side,'sum':total,'score':match[side+'Goals']})
    date=re.search(r'/ (202[56]-\d\d-\d\d) /',text).group(1)
    return {'players':rows,'issues':issues,'date':date,'sourceTeamNames':sides,'evidenceTier':'C'}

def collect(args):
    cache=Cache(args.cache);out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    for competition,name,league,category,expected in COMPETITIONS:
        if args.competition and competition not in args.competition:continue
        manifestStart=len(cache.manifest);url=f'https://www.profixio.com/app/lx/competition/leagueid{league}?t=schedule&f=played'
        matches={};duplicates=[];issues=[]
        for page in cache.pages(url):
            for row in schedule(page,competition):
                key=row['sourceMatchId']
                if row['stage']!='REGULAR_SEASON':continue
                if key in matches:
                    duplicates.append(key)
                    if matches[key]!=row:raise ValueError('Conflicting duplicate match '+key)
                matches[key]=row
        if len(matches)!=expected:issues.append({'kind':'RESULT_COVERAGE','expected':expected,'found':len(matches)})
        teams={}
        for i,row in enumerate(matches.values()):
            row['sourceUrl']=f"https://www.profixio.com/app/lx/match/{row['sourceMatchId']}";row['id']=f"profixio:{row['sourceMatchId']}";row['qualityIssues']=[]
            for side in ['home','away']:
                team=row[side];team['id']='profixio:team:'+team['sourceTeamId'];teams[team['id']]=team
            if args.pdf and competition=='swe-1':
                code='2500101'
                pdfUrl=f"https://handballstats.se/stat_sve/xml/2025/{code}/PDF/{row['sourceMatchId']}_s.pdf"
                try:
                    row['pdf']=pdf_stats(cache.request(pdfUrl),row);row['pdf']['sourceUrl']=pdfUrl
                except (ValueError,urllib.error.URLError,TimeoutError)as error:row['qualityIssues'].append({'kind':'PDF_REJECTED','sourceUrl':pdfUrl,'reason':str(error)})
            if args.protocols and ('pdf'not in row or row['pdf']['issues']):
                try:
                    page=cache.html(row['sourceUrl']);row['protocol']=protocol(match_data(page),row)
                    dates=Document(page).root.find(lambda n:n.tag=='span'and re.fullmatch(r'202[56]-\d\d-\d\d',n.text())is not None)
                    row['date']=dates[0].text()if dates else None
                except (ValueError,urllib.error.URLError,TimeoutError)as error:row['qualityIssues'].append({'kind':'PROTOCOL_REJECTED','reason':str(error)})
            if 'pdf'in row:row['date']=row['pdf']['date']
            if i%20==0:print(json.dumps({'competition':competition,'parsed':i+1,'found':len(matches)},ensure_ascii=True),flush=True)
        canonical='se_handbollsligan_herr'if competition=='swe-1'else competition
        for row in matches.values():row['competition']=canonical
        dataset={'schemaVersion':'empirical-handball-observations/1','parserVersion':PARSER,'competition':canonical,'collectionKey':competition,'name':name,'country':'SE','category':category,'season':'2025-26','seasonStatus':'COMPLETE_SEASON','stage':'REGULAR_SEASON','expectedMatches':expected,'sourceUrl':url,'matches':list(matches.values()),'teams':list(teams.values()),'duplicates':duplicates,'qualityIssues':issues,'sources':cache.manifest[manifestStart:]}
        (out/(competition+'-2025-26.json')).write_text(json.dumps(dataset,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        print(json.dumps({'competition':competition,'complete':True,'matches':len(matches),'protocols':sum('protocol'in m for m in matches.values()),'pdfs':sum('pdf'in m for m in matches.values())}),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',default='.tmp/empirical-cache/public');p.add_argument('--out',default='data/empirical-handball/normalized');p.add_argument('--competition',action='append');p.add_argument('--protocols',action='store_true');p.add_argument('--pdf',action='store_true');collect(p.parse_args())
