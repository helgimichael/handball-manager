/**
 * Camera2D -- a generic, domain-agnostic 2D viewport camera (zoom + pan).
 * Deliberately has ZERO knowledge of handball, courts, meters, or any
 * other STARKVIS domain concept: it operates purely on abstract
 * rectangles ("show this Rect2D within that base Rect2D"). This is what
 * makes it reusable across any future STARKVIS surface that needs
 * zoom/pan over a fixed-size canvas (e.g. video review, formation
 * boards, court-adjacent visualizations) -- not just the tactics board.
 *
 * Core invariant: the camera's own viewport is ALWAYS a subset of the
 * base viewport it's applied to. This is enforced structurally by
 * clampPan/clampZoom, not by a runtime check -- so "the visible area can
 * never show empty space beyond the base canvas" holds by construction,
 * at every zoom level, including the minimum (100%, where pan is
 * necessarily forced to zero because the viewport already equals the
 * base viewport exactly).
 *
 * applyCameraToViewport is the ONLY function that turns (base rect +
 * camera) into an actual displayed rect -- callers (e.g. MasterCourt.tsx)
 * feed that into their own coordinate systems (SVG viewBox, pointer
 * transforms, etc.); Camera2D itself never touches any of that.
 */

export type Point2D = { x: number; y: number };
export type Rect2D = { x: number; y: number; width: number; height: number };
export type Camera2D = { zoom: number; panX: number; panY: number };

// 100% is the minimum -- zooming "out" beyond the base viewport would
// require showing area outside the canvas, which no consumer of this
// camera wants (a court, a video frame, a formation board all have a
// fixed real extent with nothing meaningful beyond it).
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.25;
export const DEFAULT_CAMERA: Camera2D = Object.freeze({ zoom: MIN_ZOOM, panX: 0, panY: 0 });

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

// The displayed viewport (base size / zoom) must stay entirely within
// the base rect -- solving viewportEdge >= baseEdge for pan at a given
// zoom yields this exact bound. At zoom === MIN_ZOOM the viewport equals
// the base rect exactly, so the bound collapses to zero: pan is
// mechanically forced to (0, 0), never a special case.
function clampPan(pan: Point2D, baseViewport: Rect2D, zoom: number): Point2D {
  const viewportWidth = baseViewport.width / zoom;
  const viewportHeight = baseViewport.height / zoom;
  const maxOffsetX = (baseViewport.width - viewportWidth) / 2;
  const maxOffsetY = (baseViewport.height - viewportHeight) / 2;
  return {
    x: Math.min(maxOffsetX, Math.max(-maxOffsetX, pan.x)),
    y: Math.min(maxOffsetY, Math.max(-maxOffsetY, pan.y)),
  };
}

function withZoom(camera: Camera2D, zoom: number, baseViewport: Rect2D): Camera2D {
  const clampedZoom = clampZoom(zoom);
  const pan = clampPan({ x: camera.panX, y: camera.panY }, baseViewport, clampedZoom);
  return { zoom: clampedZoom, panX: pan.x, panY: pan.y };
}

export function zoomIn(camera: Camera2D, baseViewport: Rect2D): Camera2D {
  return withZoom(camera, camera.zoom + ZOOM_STEP, baseViewport);
}

export function zoomOut(camera: Camera2D, baseViewport: Rect2D): Camera2D {
  return withZoom(camera, camera.zoom - ZOOM_STEP, baseViewport);
}

export function setZoom(camera: Camera2D, zoom: number, baseViewport: Rect2D): Camera2D {
  return withZoom(camera, zoom, baseViewport);
}

// Zooms toward a specific point (e.g. the mouse cursor's position,
// converted into the same coordinate space as baseViewport) instead of
// the viewport's own center -- the point stays visually fixed under the
// cursor while the zoom level changes, which is what makes scroll-to-
// zoom feel natural instead of disorienting.
export function zoomAt(camera: Camera2D, targetZoom: number, focusPoint: Point2D, baseViewport: Rect2D): Camera2D {
  const clampedZoom = clampZoom(targetZoom);
  const oldViewport = applyCameraToViewport(baseViewport, camera);
  const fractionX = (focusPoint.x - oldViewport.x) / oldViewport.width;
  const fractionY = (focusPoint.y - oldViewport.y) / oldViewport.height;

  const newWidth = baseViewport.width / clampedZoom;
  const newHeight = baseViewport.height / clampedZoom;
  const newViewportX = focusPoint.x - fractionX * newWidth;
  const newViewportY = focusPoint.y - fractionY * newHeight;

  const baseCenterX = baseViewport.x + baseViewport.width / 2;
  const baseCenterY = baseViewport.y + baseViewport.height / 2;
  const pan = clampPan(
    { x: newViewportX + newWidth / 2 - baseCenterX, y: newViewportY + newHeight / 2 - baseCenterY },
    baseViewport,
    clampedZoom,
  );
  return { zoom: clampedZoom, panX: pan.x, panY: pan.y };
}

export function panBy(camera: Camera2D, delta: Point2D, baseViewport: Rect2D): Camera2D {
  const pan = clampPan({ x: camera.panX + delta.x, y: camera.panY + delta.y }, baseViewport, camera.zoom);
  return { zoom: camera.zoom, panX: pan.x, panY: pan.y };
}

export function resetCamera(): Camera2D {
  return DEFAULT_CAMERA;
}

export function applyCameraToViewport(baseViewport: Rect2D, camera: Camera2D): Rect2D {
  const width = baseViewport.width / camera.zoom;
  const height = baseViewport.height / camera.zoom;
  const centerX = baseViewport.x + baseViewport.width / 2 + camera.panX;
  const centerY = baseViewport.y + baseViewport.height / 2 + camera.panY;
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}
