import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterNextPaint } from './afterNextPaint';

test('initialization yields a frame and then a task before beginning blocking work', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalFrame = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible' } });
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  try {
    let began = false;
    const pending = afterNextPaint().then(() => { began = true; });
    await Promise.resolve();
    assert.equal(began, false);
    assert.ok(frame);
    frame(0);
    await Promise.resolve();
    assert.equal(began, false, 'a frame callback itself runs before paint; work must wait for the next task');
    await pending;
    assert.equal(began, true);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (originalFrame) Object.defineProperty(globalThis, 'requestAnimationFrame', originalFrame); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
  }
});

test('a hidden tab does not depend on a suspended animation frame', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'hidden' } });
  try { await afterNextPaint(); }
  finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});
