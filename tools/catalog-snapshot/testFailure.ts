export function thrownBy(operation: () => unknown): unknown {
  let error: unknown = null;
  try {
    operation();
  } catch (cause) {
    error = cause;
  }
  return error;
}
