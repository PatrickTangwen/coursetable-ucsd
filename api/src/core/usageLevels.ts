export type UsageLevel = 'ok' | 'attention' | 'urgent';

// Documented maintainer thresholds: attention at 70 percent and urgent
// review at 90 percent of an allowance or budget.
export function classifyUsageLevel(
  used: number,
  allowance: number,
): UsageLevel {
  if (used >= allowance * 0.9) return 'urgent';
  if (used >= allowance * 0.7) return 'attention';
  return 'ok';
}
