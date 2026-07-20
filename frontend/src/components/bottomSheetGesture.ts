export type PointerPosition = {
  x: number;
  y: number;
};

export function isDownwardCloseGesture(
  start: PointerPosition,
  end: PointerPosition,
) {
  const deltaX = Math.abs(end.x - start.x);
  const deltaY = end.y - start.y;
  return deltaY >= 64 && deltaY > deltaX * 1.25;
}
