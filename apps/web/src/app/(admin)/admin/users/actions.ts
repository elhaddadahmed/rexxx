'use server';

import { revalidatePath } from 'next/cache';
import { createUserWithRole } from '@/lib/auth-server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const createUserSchema = z.object({
  email: z.string().email('Ungültige E-Mail'),
  firstName: z.string().min(1, 'Vorname erforderlich'),
  lastName: z.string().min(1, 'Nachname erforderlich'),
  role: z.enum(['employee', 'manager', 'hr_admin', 'company_admin']),
  companyId: z.string().uuid('Ungültige Firma'),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

export async function createUserAction(input: CreateUserInput) {
  try {
    // Validierung
    const validated = createUserSchema.parse(input);

    // Get current user from cookie/session
    const cookieStore = cookies();
    // In einer echten App würde man hier die Session aus dem Cookie lesen
    // und den User-ID extrahieren. Hier verwenden wir einen Placeholder.
    
    const adminUserId = ''; // Müsste aus Auth Session kommen
    if (!adminUserId) {
      return {
        success: false,
        error: 'Benutzer nicht authentifiziert',
      };
    }

    const newUser = await createUserWithRole(
      adminUserId,
      validated.email,
      validated.role,
      validated.companyId,
      validated.firstName,
      validated.lastName,
    );

    revalidatePath('/admin/users');

    return {
      success: true,
      userId: newUser.id,
      message: `Benutzer ${validated.email} erstellt. Einladung wurde gesendet.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
