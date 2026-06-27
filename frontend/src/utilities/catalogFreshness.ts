import type { CatalogMetadata, SupportedTerm } from '../queries/api';
import type { Season } from '../queries/graphql-types';

type CatalogFreshnessCourses = {
  readonly [seasonCode: string]: {
    readonly metadata: CatalogMetadata;
  };
};

export function toRelativeUpdateTime(date: Date, now = Date.now()) {
  const nowTime = now / 1000;
  let lastUpdateTime = date.getTime() / 1000;
  if (lastUpdateTime > nowTime) lastUpdateTime -= 24 * 60 * 60;
  const diffInSecs = nowTime - lastUpdateTime;
  if (diffInSecs < 60) {
    return `${Math.floor(diffInSecs)} sec${Math.floor(diffInSecs) > 1 ? 's' : ''}`;
  } else if (diffInSecs < 3600) {
    const diffInMins = Math.floor(diffInSecs / 60);
    return `${diffInMins} min${diffInMins > 1 ? 's' : ''}`;
  } else if (diffInSecs < 86400) {
    const diffInHrs = Math.floor(diffInSecs / 3600);
    return `${diffInHrs} hr${diffInHrs > 1 ? 's' : ''}`;
  }
  const diffInDays = Math.floor(diffInSecs / 86400);
  return `${diffInDays} day${diffInDays > 1 ? 's' : ''}`;
}

export function getCatalogLastUpdated(courses: CatalogFreshnessCourses) {
  if (Object.keys(courses).length === 0) return new Date();
  return new Date(
    Math.max(
      ...Object.values(courses).map((x) => Number(x.metadata.last_update)),
    ),
  );
}

function termHasEnded(term: SupportedTerm, now: Date): boolean {
  if (term.frozen) return true;
  if (!term.date_range) return false;
  const end = new Date(`${term.date_range.end}T23:59:59.999Z`);
  return end < now;
}

function formatHistoricalSnapshotDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatSnapshotStalenessLabel(
  term: SupportedTerm | undefined,
  generatedAt: string | null | undefined,
  now = new Date(),
): string | null {
  if (term && termHasEnded(term, now)) {
    const asOf = term.date_range?.end
      ? formatHistoricalSnapshotDate(term.date_range.end)
      : term.label;
    return `As of ${asOf} · historical snapshot, not live`;
  }

  const currentGeneratedAt = term?.generated_at ?? generatedAt;
  if (!currentGeneratedAt) return null;
  const generatedDate = new Date(currentGeneratedAt);
  if (Number.isNaN(generatedDate.getTime())) return null;
  const elapsedMs = now.getTime() - generatedDate.getTime();
  const days = Math.max(0, Math.floor(elapsedMs / 86_400_000));
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated 1 day ago';
  return `Updated ${days} days ago`;
}

export function getCatalogStalenessLabel(
  courses: CatalogFreshnessCourses,
  season: Season,
  now = new Date(),
): string {
  const catalog = courses[season];
  const term =
    catalog?.metadata.terms?.find((item) => item.term === season) ??
    Object.values(courses)
      .flatMap((item) => item.metadata.terms ?? [])
      .find((item) => item.term === season);
  const generatedAt =
    term?.generated_at ?? catalog?.metadata.last_update.toISOString();
  return (
    formatSnapshotStalenessLabel(term, generatedAt, now) ??
    `Updated ${toRelativeUpdateTime(getCatalogLastUpdated(courses), now.getTime())} ago`
  );
}
