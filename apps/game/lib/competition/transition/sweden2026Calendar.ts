import type { Evidence, QualificationStage } from './types';

const source: Evidence = {
  url: 'https://www.svenskhandboll.se/download/18.1cea497a19ef5b47502165c4/1782290941630/Terminplanen%2026-27%20version%207%20webb.xlsx',
  section: '2026-2027 sheet; March rows 173,175,177-178; April rows 203-206; D:AH = calendar days 1:31; merged cells are permitted date windows, not exact appointments.',
};
const day = (month: string, first: number, last = first) => ({ startDate: `2027-${month}-${String(first).padStart(2,'0')}`, endDate: `2027-${month}-${String(last).padStart(2,'0')}`, source });
const hbl = [day('03',29), day('04',3,4), day('04',6), day('04',9), day('04',14)];
const haSemi = [day('03',25,26),day('03',29),day('04',3,4)];
const haFinal = [day('04',7),day('04',11),day('04',17,18)];
const northSemi = [day('03',29),day('04',3,4),day('04',7)];
const southSemi = [day('03',20,21),day('03',25,26),day('03',29)];
const windows: Readonly<Record<string, NonNullable<QualificationStage['gameWindows']>>> = {
  'hbl-11':hbl,'hbl-12':hbl,'hbl-13':hbl,
  'ha-semi-n':haSemi,'ha-semi-s':haSemi,'ha-final-11':haFinal,'ha-final-12':haFinal,
  'd1-n-pre':[day('03',20,21),day('03',25,26)],
  'd1-n-semi-9':northSemi,'d1-n-semi-10':northSemi,
  'd1-n-final':[day('04',11),day('04',17,18),day('04',21)],
  'd1-s-semi-v':southSemi,'d1-s-semi-s':southSemi,
  'd1-s-final-9':[day('04',3,4),day('04',11),day('04',17,18)],
  'd1-s-final-10':[day('04',3,4),day('04',11),day('04',17,18)],
};
/** The terminal procedure is the rule-2:2 clarification, not the appendix's separate breakaway exercise. */
export function qualificationScheduling2026(id: string): Pick<QualificationStage,'gameWindows'|'terminalDecider'> {
  return { gameWindows:windows[id], terminalDecider:{ kind:'SEVEN_METRES_AFTER_TWO_OVERTIMES', source:{
    url:'https://www.svenskhandboll.se/download/18.360a4fd619fada88abaa4be5/1785837407919/T%C3%A4vlingshandboken%202026-2027%2C%20sid%2030%20Bilaga%201.pdf',
    section:'Bilaga 1, printed p.30: Avgörande genom sjumeterskast, rule 2:2 clarification, item 1; THB chapter 2 §2:9 (printed p.6), best-of-2/3/5 clarification (printed p.7).',
  } } };
}
