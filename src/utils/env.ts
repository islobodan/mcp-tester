export function filterEnvironmentVariables(
  env?: Record<string, string | undefined>
): Record<string, string> {
  if (!env) return {};

  return Object.fromEntries(
    Object.entries(env).filter(([_, value]) => value !== undefined)
  ) as Record<string, string>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mergeEnvironments(
  base?: Record<string, string | undefined>,
  additional?: Record<string, string | undefined>
): Record<string, string> {
  return {
    ...filterEnvironmentVariables(base),
    ...filterEnvironmentVariables(additional),
  };
}
