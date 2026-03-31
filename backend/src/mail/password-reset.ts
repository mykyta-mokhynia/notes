import nodemailer from 'nodemailer';
import { config } from '../config';

function formatFromAddress(): string {
  const fromName = config.smtpFromName.trim();
  const fromEmail = config.smtpFromEmail.trim();
  return fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
}

export function buildPasswordResetUrl(token: string): string {
  const baseUrl = config.appBaseUrl.replace(/\/$/, '');
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

export function canSendPasswordResetEmail(): boolean {
  return !!config.smtpHost.trim() && !!config.smtpFromEmail.trim();
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  if (!canSendPasswordResetEmail()) {
    throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth:
      config.smtpUser || config.smtpPass
        ? {
            user: config.smtpUser,
            pass: config.smtpPass,
          }
        : undefined,
  });

  const resetUrl = buildPasswordResetUrl(token);

  await transporter.sendMail({
    from: formatFromAddress(),
    to: email,
    subject: 'Reset your Notes password',
    text: [
      'You requested a password reset for your Notes account.',
      '',
      `Open this link to choose a new password: ${resetUrl}`,
      '',
      `This link expires in ${config.passwordResetTtlMinutes} minutes.`,
      'If you did not request this change, you can ignore this email.',
    ].join('\n'),
    html: [
      '<p>You requested a password reset for your Notes account.</p>',
      `<p><a href="${resetUrl}">Open this link to choose a new password</a></p>`,
      `<p>This link expires in ${config.passwordResetTtlMinutes} minutes.</p>`,
      '<p>If you did not request this change, you can ignore this email.</p>',
    ].join(''),
  });
}
