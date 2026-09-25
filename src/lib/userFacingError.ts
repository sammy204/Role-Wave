/** Keep technical failures in logs while showing safe, actionable copy in the UI. */
export function getUserFacingError(error: unknown, fallback: string): string {
  console.error(error);
  return fallback;
}

/** Authentication errors need actionable copy without exposing account details. */
export function getAuthErrorMessage(error: unknown, fallback: string): string {
  console.error(error);
  const authError = error as { message?: unknown; code?: unknown } | null;
  const message = typeof authError?.message === 'string' ? authError.message.toLowerCase() : '';
  const code = typeof authError?.code === 'string' ? authError.code.toLowerCase() : '';

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please check your details and try again.';
  }
  if (message.startsWith('no employer account found') || message.startsWith('no candidate account found')) {
    return typeof authError?.message === 'string' ? authError.message : fallback;
  }
  if (message.includes('email not confirmed')) return 'Please confirm your email address before signing in.';
  if (message.includes('too many requests') || message.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  return fallback;
}
