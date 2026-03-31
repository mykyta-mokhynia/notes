const AUTH_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters long.',
  GOOGLE_AUTH_DISABLED: 'Google sign in is not configured on the server yet.',
  GOOGLE_AUTH_FAILED: 'Google sign in could not be completed. Try again.',
  GOOGLE_TOKEN_INVALID: 'Google sign in token was rejected. Try again.',
  GOOGLE_AUDIENCE_INVALID: 'Google sign in is configured for a different client ID.',
  GOOGLE_PROFILE_INVALID: 'Google account details could not be verified.',
  GOOGLE_ACCOUNT_CONFLICT: 'This Google account is already linked to another user.',
  GOOGLE_EMAIL_MISMATCH: 'Use a Google account with the same email as this account.',
  GOOGLE_NOT_LINKED: 'This account is not linked to Google.',
  PASSWORD_REQUIRED_TO_UNLINK_GOOGLE:
    'Set a password before unlinking Google so you can still sign in.',
  CURRENT_PASSWORD_REQUIRED: 'Enter your current password to change it.',
  CURRENT_PASSWORD_INVALID: 'Current password is incorrect.',
  PASSWORD_RESET_UNAVAILABLE: 'Password reset email delivery is unavailable right now.',
};

export function authErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  return AUTH_ERROR_MESSAGES[value] ?? value;
}
