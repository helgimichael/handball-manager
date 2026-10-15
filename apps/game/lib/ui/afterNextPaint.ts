/** Yield to a rendering opportunity before synchronous initialization work.
 * This is a frame/task boundary, never a minimum display duration or timeout.
 */
export function afterNextPaint(): Promise<void> {
  return new Promise(resolve => {
    if (document.visibilityState === 'hidden') { setTimeout(resolve, 0); return; }
    requestAnimationFrame(() => { setTimeout(resolve, 0); });
  });
}
