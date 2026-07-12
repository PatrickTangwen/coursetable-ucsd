export function deploymentIdentity(value: unknown) {
  if (!isObject(value) || !Array.isArray(value.versions))
    throw new Error('Worker deployment status is invalid');
  const { versions: rawVersions } = value;
  const versions: unknown[] = rawVersions;
  const active = versions.find(
    (version) => isObject(version) && version.percentage === 100,
  );
  if (!isObject(active) || typeof active.version_id !== 'string')
    throw new Error('Worker deployment has no 100 percent version');
  if (typeof value.created_on !== 'string')
    throw new Error('Worker deployment timestamp is invalid');
  return {
    exists: true as const,
    createdAt: value.created_on,
    versionId: active.version_id,
  };
}

function isObject(value: unknown): value is { [key: string]: unknown } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
