"""Official player-season rows; intentionally separate from match-level samples."""
import json,re,argparse
from pathlib import Path
from urllib.parse import parse_qs,urlparse
from empirical_cache import Cache
from empirical_html import Document

def player_table(text,keeper=False,goal_view=False):
    root=Document(text).root
    tables=root.find(lambda n:n.tag=='table'and n.attrs.get('id')in {'ContentPlaceHolder_GridViewStatistics','ContentPlaceHolder1_GridViewStatistics'})
    if len(tables)!=1:raise ValueError('Official statistics table missing')
    if goal_view and [n.text()for n in tables[0].find(lambda n:n.tag=='th')]!=['#','Lag','Namn','pos','SM','må','s','%','STM','STS','ST%','MEP']:raise ValueError('Official goal-view columns changed')
    rows=[]
    for tr in tables[0].find(lambda n:n.tag=='tr'):
        cells=[c for c in tr.children if hasattr(c,'tag')and c.tag=='td']
        if not cells:continue
        links=tr.find(lambda n:n.tag=='a'and'player='in(n.attrs.get('href')or''))
        if len(links)!=1:continue
        href=links[0].attrs['href'];params=parse_qs(urlparse(href).query)
        values=[c.text()for c in cells];base={'sourcePlayerId':params['player'][0],'sourceTeamId':params['team'][0],'sourceName':links[0].text(),'appearances':int(values[3]if keeper else values[4]),'position':'MV'if keeper else values[3]}
        if keeper:base.update({'ordinarySaves':int(values[4]),'ordinaryShotsFaced':int(values[5]),'sevenMetreSaves':int(values[7]),'sevenMetreShotsFaced':int(values[8]),'saves':int(values[4])+int(values[7]),'shotsFaced':int(values[5])+int(values[8])})
        elif goal_view:
            if len(values)!=12:raise ValueError('Official goal-view row width changed')
            base.update({'goals':int(values[5]),'shots':int(values[6]),'sevenMetreGoals':int(values[8]),'sevenMetreAttempts':int(values[9])})
            if not 0<=base['sevenMetreGoals']<=base['sevenMetreAttempts']<=base['shots'] or not base['sevenMetreGoals']<=base['goals']<=base['shots']:raise ValueError('Invalid official goal-view denominators')
        else:base.update({'goals':int(values[5]),'sourceTechnicalErrors':int(values[6]),'assists':int(values[7]),'suspensions':int(values[8])})
        rows.append(base)
    if not rows:raise ValueError('No official player rows')
    return rows

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',default='.tmp/empirical-cache/public');p.add_argument('--out',default='data/empirical-handball/normalized');args=p.parse_args();cache=Cache(args.cache)
    for competition,base,league in [('se_handbollsligan_herr','https://handballstats.se/statistics/herr/statistics/statistics.aspx','2500101'),('swe-w-1','https://handballstats.se/statistics/dam/overview.aspx','2500201')]:
        first=len(cache.manifest);urls=[f'{base}?y=2025&l={league}&p=Alla&t=0&o=0&ha=Alla',f'{base}?y=2025&l={league}&p=MV&t=0&o=0&ha=Alla'];records=[player_table(cache.html(url),i==1)for i,url in enumerate(urls)]
        output={'schemaVersion':'empirical-player-seasons/1','parserVersion':'handballstats-html/1','competition':competition,'season':'2025-26','seasonStatus':'COMPLETE_SEASON','stage':'REGULAR_SEASON','players':records[0],'keepers':records[1],'sources':cache.manifest[first:],'notes':['Keeper ordinary and penalty columns retained separately and explicitly added','Season statistics never used as keeper-match variance','Source player/team IDs retained; no name-only player merges']}
        Path(args.out).mkdir(parents=True,exist_ok=True);Path(args.out,competition+'-player-seasons-2025-26.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(competition,len(records[0]),len(records[1]),flush=True)
