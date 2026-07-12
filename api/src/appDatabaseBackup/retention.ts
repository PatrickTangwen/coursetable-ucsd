import type { AppDatabaseBackupManifest } from './manifest.js';

export function selectBackupRetention(
  manifests: AppDatabaseBackupManifest[],
  namespace: string,
  limits = { daily: 7, weekly: 4 },
) {
  const eligible = manifests
    .filter(({ dumpKey }) => isKeyInsideNamespace(dumpKey, namespace))
    .toSorted(
      (left, right) =>
        Date.parse(right.backupTime) - Date.parse(left.backupTime),
    );
  const dailySlots = new Set<string>();
  const weeklySlots = new Set<string>();
  const retainedKeys = new Set<string>();

  for (const manifest of eligible) {
    const dailySlot = manifest.backupTime.slice(0, 10);
    if (dailySlots.size < limits.daily && !dailySlots.has(dailySlot)) {
      dailySlots.add(dailySlot);
      retainedKeys.add(manifest.dumpKey);
    }
  }

  for (const manifest of eligible) {
    const weeklySlot = utcWeekStart(manifest.backupTime);
    if (weeklySlots.size < limits.weekly && !weeklySlots.has(weeklySlot)) {
      weeklySlots.add(weeklySlot);
      retainedKeys.add(manifest.dumpKey);
    }
  }

  return {
    retain: eligible.filter(({ dumpKey }) => retainedKeys.has(dumpKey)),
    remove: eligible.filter(({ dumpKey }) => !retainedKeys.has(dumpKey)),
  };
}

export function isKeyInsideNamespace(key: string, namespace: string) {
  if (!namespace.endsWith('/') || !key.startsWith(namespace)) return false;
  const relativeKey = key.slice(namespace.length);
  return (
    relativeKey.length > 0 &&
    !relativeKey.includes('/') &&
    !relativeKey.includes('..') &&
    relativeKey.endsWith('.dump')
  );
}

function utcWeekStart(backupTime: string) {
  const date = new Date(backupTime);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}
