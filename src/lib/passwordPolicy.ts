export const PASSWORD_REQUIREMENTS = 'Password must contain at least one lowercase letter, one uppercase letter, and one number.';

export function validatePassword(password: string): string | null {
  if (!/[a-z]/.test(password)) return PASSWORD_REQUIREMENTS;
  if (!/[A-Z]/.test(password)) return PASSWORD_REQUIREMENTS;
  if (!/[0-9]/.test(password)) return PASSWORD_REQUIREMENTS;
  return null;
}
