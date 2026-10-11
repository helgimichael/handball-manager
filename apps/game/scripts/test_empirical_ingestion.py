"""Offline parser tests; synthetic fixtures here never feed shipped profiles."""
import unittest,importlib.util,sys,json
from unittest.mock import patch,MagicMock
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
collector=load('collect-empirical-sweden');players=load('collect-empirical-player-seasons')
class Ingestion(unittest.TestCase):
    def test_schedule_identity_and_malformed(self):
        html='''<div wire:key="mc_mini_100" x-init="homegoals: '2', awaygoals: '1'"><span>Omgång 1</span><a href="/teams/1">Team A</a><a href="/teams/2">Team B</a></div>'''
        row=collector.schedule(html,'test')[0];self.assertEqual(row['stage'],'REGULAR_SEASON');self.assertEqual(row['homeGoals'],2);self.assertRaises(ValueError,collector.schedule,html.replace("homegoals: '2'","homegoals: ''"),'test')
    def test_protocol_reconciles_and_duplicate_rejected(self):
        match={'sourceMatchId':'100','home':{'sourceTeamId':'1'},'away':{'sourceTeamId':'2'},'homeGoals':1,'awayGoals':0}
        goal={'id':1,'side':'home','isGoal':True,'playerId':7,'playerName':'TEST Player','goals':1,'isPenalty':True}
        end={'id':2,'side':'center','endsPeriod':True,'minute':60,'scoreH':'1','scoreA':'0'}
        data={'kampId':100,'state':'full_time','homeWebid':1,'awayWebid':2,'events':[goal,end]}
        p=collector.protocol(data,match);self.assertEqual(p['teamStats']['home']['sevenMetres'],1);self.assertEqual(p['players'][0]['goals'],1)
        data['events'].append(goal);self.assertRaises(ValueError,collector.protocol,data,match)
    def test_pdf_separate_penalty_columns_and_denominator(self):
        text='''SPELARSTATISTIK
Team A - Team B 2 - 1 (1 - 1)
100 / 2025-10-11 / TEST
Team A:
Målvakt Rädd/ 7m rädd/
1 TEST Keeper A 1/2 (50%) 0/0 1 0 0 0 0 0 0 0 0 0
Utespelare Mål/ 7m mål/
2 TEST Field A 1/2 (50%) 1/1 (100%) 0 0 0 0 0 0 0 1 0 0
Team B:
Målvakt Rädd/ 7m rädd/
1 TEST Keeper B 0/1 (0%) 0/1 (0%) 2 0 0 0 0 0 0 0 0 0
Utespelare Mål/ 7m mål/
2 TEST Field B 1/2 (50%) 0/0 0 0 0 0 0 0 0 0 0 0'''
        document=MagicMock();document.__enter__.return_value.pages=[MagicMock()];document.__enter__.return_value.pages[0].extract_text.return_value=text
        with patch('pdfplumber.open',return_value=document):
            result=collector.pdf_stats(b'fixture',{'sourceMatchId':'100','homeGoals':2,'awayGoals':1})
        self.assertEqual(result['players'][1]['goals'],2);self.assertEqual(result['players'][1]['shots'],3);self.assertTrue(result['players'][2]['denominatorValid']);self.assertEqual(result['issues'],[])
    def test_official_table_layout_is_required(self):
        self.assertRaises(ValueError,players.player_table,'<html>no statistics</html>')
    def test_goal_view_includes_penalties_once(self):
        headers=['#','Lag','Namn','pos','SM','må','s','%','STM','STS','ST%','MEP'];values=['1','Team','<a href="?player=7&amp;team=2">Test</a>','M9','26','206','334','61','37','43','86','0']
        html='<table id="ContentPlaceHolder_GridViewStatistics"><tr>'+''.join('<th>'+h+'</th>'for h in headers)+'</tr><tr>'+''.join('<td>'+v+'</td>'for v in values)+'</tr></table>'
        row=players.player_table(html,goal_view=True)[0];self.assertEqual((row['goals'],row['shots'],row['sevenMetreGoals'],row['sevenMetreAttempts']),(206,334,37,43))
        self.assertRaises(ValueError,players.player_table,html.replace('<td>43</td>','<td>335</td>'),goal_view=True)
        self.assertRaises(ValueError,players.player_table,html.replace('<th>STS</th>','<th>changed</th>'),goal_view=True)
if __name__=='__main__':unittest.main()
