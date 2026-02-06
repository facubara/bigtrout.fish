import type { CameraState, AABB } from "@/types";

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 4.0;
export const ZOOM_DEFAULT = 0.3;
const PAN_LERP = 0.08;
const ZOOM_LERP = 0.1;

export function createCamera(viewWidth: number, viewHeight: number): CameraState & { viewWidth: number; viewHeight: number } {
  return {
    x: 0,
    y: 0,
    zoom: ZOOM_DEFAULT,
    targetX: 0,
    targetY: 0,
    targetZoom: ZOOM_DEFAULT,
    viewWidth,
    viewHeight,
  };
}

export type Camera = ReturnType<typeof createCamera>;

export function updateCamera(cam: Camera): void {
  cam.x += (cam.targetX - cam.x) * PAN_LERP;
  cam.y += (cam.targetY - cam.y) * PAN_LERP;
  cam.zoom += (cam.targetZoom - cam.zoom) * ZOOM_LERP;
}

export function zoomToward(cam: Camera, worldX: number, worldY: number, delta: number): void {
  const oldZoom = cam.targetZoom;
  cam.targetZoom = clamp(oldZoom * (1 + delta * 0.001), ZOOM_MIN, ZOOM_MAX);
  const scale = cam.targetZoom / oldZoom;
  cam.targetX = worldX - (worldX - cam.targetX) * scale;
  cam.targetY = worldY - (worldY - cam.targetY) * scale;
}

export function panBy(cam: Camera, dx: number, dy: number): void {
  cam.targetX -= dx / cam.zoom;
  cam.targetY -= dy / cam.zoom;
}

export function panTo(cam: Camera, worldX: number, worldY: number): void {
  cam.targetX = worldX;
  cam.targetY = worldY;
}

export function setZoom(cam: Camera, zoom: number): void {
  cam.targetZoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
}

export function screenToWorld(cam: Camera, screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: cam.x + (screenX - cam.viewWidth / 2) / cam.zoom,
    y: cam.y + (screenY - cam.viewHeight / 2) / cam.zoom,
  };
}

export function worldToScreen(cam: Camera, worldX: number, worldY: number): { x: number; y: number } {
  return {
    x: (worldX - cam.x) * cam.zoom + cam.viewWidth / 2,
    y: (worldY - cam.y) * cam.zoom + cam.viewHeight / 2,
  };
}

export function getVisibleBounds(cam: Camera): AABB {
  const bufferCells = 200; // one cell buffer
  const halfW = cam.viewWidth / 2 / cam.zoom;
  const halfH = cam.viewHeight / 2 / cam.zoom;
  return {
    x1: cam.x - halfW - bufferCells,
    y1: cam.y - halfH - bufferCells,
    x2: cam.x + halfW + bufferCells,
    y2: cam.y + halfH + bufferCells,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
