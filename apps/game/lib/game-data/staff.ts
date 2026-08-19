import type { StaffMock } from "./types";
import { TUMBA_CLUB_ID } from "./clubs";

// Fictional staff.
export const TUMBA_STAFF: readonly StaffMock[] = [
  { id: "s-assistant", clubId: TUMBA_CLUB_ID, name: "Mikael Lindgren", role: "Assisterande tränare", nationality: "SWE", yearsAtClub: 3 },
  { id: "s-gk-coach", clubId: TUMBA_CLUB_ID, name: "Petra Sundin", role: "Målvaktstränare", nationality: "SWE", yearsAtClub: 5 },
  { id: "s-fitness", clubId: TUMBA_CLUB_ID, name: "Jonas Wester", role: "Fystränare", nationality: "SWE", yearsAtClub: 2 },
  { id: "s-physio", clubId: TUMBA_CLUB_ID, name: "Anna Blomqvist", role: "Fysioterapeut", nationality: "SWE", yearsAtClub: 4 },
  { id: "s-scout", clubId: TUMBA_CLUB_ID, name: "Rickard Öhman", role: "Huvudscout", nationality: "SWE", yearsAtClub: 1 },
  { id: "s-doctor", clubId: TUMBA_CLUB_ID, name: "Dr. Karin Fält", role: "Läkare", nationality: "SWE", yearsAtClub: 6 },
  { id: "s-teamleader", clubId: TUMBA_CLUB_ID, name: "Björn Åkesson", role: "Lagledare", nationality: "SWE", yearsAtClub: 9 },
];
