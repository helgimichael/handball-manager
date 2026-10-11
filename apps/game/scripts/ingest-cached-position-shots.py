"""Offline ingestion of acquired official goal views; acquisition is explicit opt-in."""
import argparse,hashlib,json
from pathlib import Path
from importlib import import_module
player_table=import_module('collect-empirical-player-seasons').player_table

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',default='.tmp/empirical-cache/public');p.add_argument('--out',default='data/empirical-handball/normalized/season-shots');p.add_argument('--acquire',action='store_true',help='Explicitly acquire public goal views through the shared polite cache');args=p.parse_args()
    acquisition=import_module('empirical_cache').Cache(args.cache)if args.acquire else None
    for competition,prefix,league in [('se_handbollsligan_herr','herr/statistics/statistics.aspx','2500101'),('swe-w-1','dam/overview.aspx','2500201')]:
        url=f'https://handballstats.se/statistics/{prefix}?y=2025&l={league}&p=Alla&t=0&o=0&ha=Alla&c=goal'
        if acquisition:acquisition.request(url)
        key=hashlib.sha256(url.encode()).hexdigest();cache=Path(args.cache);raw=(cache/(key+'.body')).read_bytes();source=json.loads((cache/(key+'.json')).read_text())
        if source['url']!=url or hashlib.sha256(raw).hexdigest()!=source['sha256']:raise ValueError('Cached source identity/hash mismatch')
        rows=player_table(raw.decode('utf-8-sig'),goal_view=True)
        if len({(r['sourcePlayerId'],r['sourceTeamId'])for r in rows})!=len(rows):raise ValueError('Duplicate player/team season row')
        baseline=json.loads(Path(args.out).parent.joinpath(competition+'-player-seasons-2025-26.json').read_text(encoding='utf8'))['players']
        expected={(r['sourcePlayerId'],r['sourceTeamId']):(r['goals'],r['appearances'],r['position'])for r in baseline}
        actual={(r['sourcePlayerId'],r['sourceTeamId']):(r['goals'],r['appearances'],r['position'])for r in rows}
        if actual!=expected:raise ValueError('Goal view differs from previously ingested season summary')
        data={'schemaVersion':'empirical-player-shots/1','parserVersion':'handballstats-goal-html/1','competition':competition,'season':'2025-26','seasonStatus':'COMPLETE_SEASON','stage':'REGULAR_SEASON','players':rows,'sources':[source],'notes':['Total goals and shots already include 7m; do not add penalty columns again','Official registered season position, not shot location or release role','Full player/team IDs reconcile to previously ingested official summary','Season aggregate only; no position-match variance']}
        out=Path(args.out);out.mkdir(parents=True,exist_ok=True);out.joinpath(competition+'-2025-26.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(competition,len(rows),sum(r['shots']for r in rows))
