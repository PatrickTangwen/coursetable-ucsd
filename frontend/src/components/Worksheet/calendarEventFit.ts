export function chooseCalendarEventFontSize(
  standardSize: number,
  minimumSize: number,
  fitsAt: (fontSize: number) => boolean,
): number {
  if (fitsAt(standardSize)) return standardSize;
  if (!fitsAt(minimumSize)) return minimumSize;

  let lo = minimumSize;
  let hi = standardSize;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    if (fitsAt(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
