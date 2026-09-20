import { z } from 'zod';

/**
 * Diese Schemas laufen client- UND serverseitig (siehe docs/security.md, Abschnitt 13).
 * Die serverseitige Validierung (Edge Function / Route Handler) ist die verbindliche;
 * die clientseitige Nutzung dient nur besserem UX-Feedback.
 */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ungültige E-Mail-Adresse'),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben'),
    passwordConfirmation: z.string().min(8),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwörter stimmen nicht überein',
    path: ['passwordConfirmation'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
