/** Keep technical failures in logs while showing safe, actionable copy in the UI. */
export function getUserFacingError(error: unknown, fallback: string): string {
  console.error(error);
  return fallback;
}
