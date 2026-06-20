type CatalogFreshnessCourses = {
  readonly [seasonCode: string]: {
    readonly metadata: {
      readonly last_update: Date;
    };
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
