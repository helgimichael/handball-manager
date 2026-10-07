export type MatchFrame = number[];
// Binary little-endian observed poses: tick/time u32, period u8, score u16,
// ball centimetres i16, population u8, then (person u8, x/y cm i16).
// Base64 survives both IndexedDB and portable JSON without per-number objects.
export function encodeFrames(frames: readonly MatchFrame[]): string {
  const size = frames.reduce((n, row) => n + 18 + ((row.length - 7) / 3) * 5, 0);
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  let at = 0;
  for (const row of frames) {
    view.setUint32(at, row[0], true); view.setUint32(at + 4, row[1], true);
    view.setUint8(at + 8, row[2]); view.setUint16(at + 9, row[3], true); view.setUint16(at + 11, row[4], true);
    view.setInt16(at + 13, row[5], true); view.setInt16(at + 15, row[6], true);
    const count = (row.length - 7) / 3; view.setUint8(at + 17, count); at += 18;
    for (let i = 7; i < row.length; i += 3) {
      view.setUint8(at, row[i]); view.setInt16(at + 1, row[i + 1], true); view.setInt16(at + 3, row[i + 2], true); at += 5;
    }
  }
  let text = '';
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
}
export function decodeFrames(encoded: string): MatchFrame[] {
  const text = atob(encoded), bytes = Uint8Array.from(text, c => c.charCodeAt(0)), view = new DataView(bytes.buffer);
  const frames: MatchFrame[] = [];
  let at = 0;
  while (at < bytes.length) {
    if (at + 18 > bytes.length) throw new Error('Matcharkivet innehåller en ofullständig bild.');
    const count = view.getUint8(at + 17);
    if (count > 14 || at + 18 + count * 5 > bytes.length) throw new Error('Matcharkivets spelardata är skadad.');
    const row = [view.getUint32(at, true), view.getUint32(at + 4, true), view.getUint8(at + 8), view.getUint16(at + 9, true), view.getUint16(at + 11, true), view.getInt16(at + 13, true), view.getInt16(at + 15, true)];
    at += 18;
    for (let i = 0; i < count; i++) { row.push(view.getUint8(at), view.getInt16(at + 1, true), view.getInt16(at + 3, true)); at += 5; }
    frames.push(row);
  }
  return frames;
}
/** Presentation interpolation only. Score, period and population use the
 * observed preceding frame; no event or result is predicted by this function. */
export function frameAt(frames: readonly MatchFrame[], tick: number): MatchFrame {
  let low = 0, high = frames.length - 1;
  while (low < high) { const mid = Math.ceil((low + high) / 2); if (frames[mid][0] <= tick) low = mid; else high = mid - 1; }
  const first = frames[low], next = frames[low + 1];
  if (!next || tick <= first[0]) return first;
  const fraction = (tick - first[0]) / (next[0] - first[0]);
  const row = first.slice();
  row[0] = tick;
  row[5] += (next[5] - first[5]) * fraction; row[6] += (next[6] - first[6]) * fraction;
  for (let i = 7; i < row.length; i += 3) {
    for (let n = 7; n < next.length; n += 3) if (next[n] === row[i]) {
      row[i + 1] += (next[n + 1] - row[i + 1]) * fraction; row[i + 2] += (next[n + 2] - row[i + 2]) * fraction; break;
    }
  }
  return row;
}
