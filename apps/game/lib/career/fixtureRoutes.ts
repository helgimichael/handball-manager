// Alpha hotfix: fixture ids are stored as they are, and some contain "/" -- M1.2 qualification fixtures carry the
// season, e.g. "2026/27:transition:d1-s-final-9:g1". Every route to a fixture encodes the id as one path segment,
// and every fixture page reads its segment back through `fixtureIdFromParam`, so the same stored id is found
// whether or not the router has already decoded "%2F".

/** One encoded path segment for a stored fixture id. Ids without reserved characters are unchanged. */
export const fixtureSegment = (fixtureId: string): string => encodeURIComponent(fixtureId);

export const matchDayHref = (fixtureId: string, options: { finish?: boolean } = {}): string =>
  `/career/match-day/${fixtureSegment(fixtureId)}${options.finish ? "?finish=1" : ""}`;

export const matchReportHref = (fixtureId: string): string => `/career/match-report/${fixtureSegment(fixtureId)}`;

export const fixtureHref = (fixtureId: string): string => `/career/fixtures/${fixtureSegment(fixtureId)}`;

/** The stored fixture id behind a dynamic route segment. Stored ids never contain "%", so decoding is idempotent. */
export function fixtureIdFromParam(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? param.join("/") : (param ?? "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Compares two career paths regardless of how their fixture segment is encoded. */
export function samePath(a: string, b: string): boolean {
  return fixtureIdFromParam(a) === fixtureIdFromParam(b);
}
