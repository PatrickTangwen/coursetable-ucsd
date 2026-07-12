export function getRequiredEnvironmentVariable(
  environment: NodeJS.ProcessEnv,
  name: string,
) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`env config missing: ${name}`);
  return value;
}
