/**
 * Validation rules shared by the auth forms. They are plain objects so they
 * can be passed straight to `register()`, which keeps the messages in one
 * place instead of a copy per screen.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailRules = {
  required: 'Enter your email address.',
  pattern: {
    value: EMAIL_PATTERN,
    message: 'Enter a valid email address.',
  },
};
