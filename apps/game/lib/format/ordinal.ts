// HM-ALPHA3-M10: Swedish ordinal numerals -- 1:a, 2:a, 3:e … 11:e, 12:e, 21:a, 22:a.
// Table places were written with ":a" everywhere ("14:a i ligan"); only 1 and 2
// (and 21, 22, 31 …, but not 11 and 12) take ":a".
export function svOrdinal(n: number): string {
  const tens = n % 100;
  return `${n}:${(n % 10 === 1 || n % 10 === 2) && tens !== 11 && tens !== 12 ? "a" : "e"}`;
}
