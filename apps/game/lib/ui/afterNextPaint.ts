/** Yield to a rendering opportunity before synchronous initialization work.
 * This is a frame/task boundary, never a minimum display duration or timeout.
 * HM-ALPHA3-M10: a window can report itself visible while delivering no
 * animation frames (covered or embedded windows), so a short task-based
 * fallback resolves too -- opening a career never waits on a frame that does not come.
 */
const FRAME_FALLBACK_MS = 120;

export function afterNextPaint(): Promise<void> {
  return new Promise(resolve => {
    if (document.visibilityState === 'hidden') { setTimeout(resolve, 0); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    requestAnimationFrame(() => { setTimeout(finish, 0); });
    setTimeout(finish, FRAME_FALLBACK_MS);
  });
}
