/** Post-match statistics only. Never imported by the simulation. */
export function distribution(values: readonly (number | null)[]) {
  const x = values.filter((n): n is number => n !== null && Number.isFinite(n)).sort((a,b)=>a-b);
  const n=x.length, mean=n ? x.reduce((a,b)=>a+b,0)/n : null;
  const q=(p:number)=> { if (!n) return null; const i=(n-1)*p; return x[Math.floor(i)]+(x[Math.ceil(i)]-x[Math.floor(i)])*(i-Math.floor(i)); };
  return { n, mean, median:q(.5), sd:n>1 ? Math.sqrt(x.reduce((a,b)=>a+(b-mean!)**2,0)/(n-1)) : null,
    min:x[0]??null, max:x[n-1]??null, p05:q(.05), p10:q(.1), p25:q(.25), p75:q(.75), p90:q(.9), p95:q(.95) };
}
export type Distribution = ReturnType<typeof distribution>;
export const ratio=(a:number,b:number)=>b>0 ? a/b : null;
/** Wilson 95% interval; descriptive, not a league expectation. */
export function wilson(successes:number,n:number) {
  if (!n) return null;
  const z=1.959963984540054,p=successes/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
  return {low:c-h,high:c+h,confidence:.95,n};
}
