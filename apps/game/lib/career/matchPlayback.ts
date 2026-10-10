/** Presentation clock only: bounded by states that have actually been recorded. */
export function playbackTick(tick:number,elapsedMs:number,speed:number,lastTick:number):number {
  return Math.min(lastTick,tick+Math.max(0,elapsedMs)*speed/50);
}
