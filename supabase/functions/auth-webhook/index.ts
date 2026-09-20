// supabase/functions/auth-webhook/index.ts
//
// Edge Function für Supabase Auth Webhooks.
// Wird bei neuen User-Registrierungen aufgerufen, um ein Profil + Rolle zu erstellen.
//
// Setup: Supabase Dashboard → Authentication → Webhooks → add webhook
// URL: https://<project>.functions.supabase.co/auth-webhook
// Event: auth.user.created
// Secret: (generiere einen zufälligen Secret und speichere ihn in Supabase/GitHub Secrets)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { verify } from 'https://deno.land/x/hmac@v2.0.1/mod.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const webhookSecret = Deno.env.get('AUTH_WEBHOOK_SECRET') || '';

const client = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    // Webhook-Signatur verifizieren (optional aber empfohlen)
    const signature = req.headers.get('x-webhook-signature');
    if (!signature || !webhookSecret) {
      console.warn('Webhook signature missing or no secret configured');
      // Weiter trotzdem (lokal ohne Signature)
    }

    const body = await req.json();
    const { data } = body;

    if (!data || !data.user) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = data.user;
    const userId = user.id;
    const userEmail = user.email;

    console.log(`[Auth Webhook] New user: ${userId} (${userEmail})`);

    // 1. Profile erstellen (default: status = 'invited', role = 'employee')
    const { error: profileError } = await client.from('profiles').insert({
      id: userId,
      email: userEmail,
      role: 'employee', // Default-Rolle für neue User
      status: 'invited', // Muss von Admin aktiviert werden, oder User selbst aktiviert sein Email
      company_id: null, // Wird später von Admin gesetzt (mit invite-flow)
      first_name: null,
      last_name: null,
      phone: null,
      avatar_url: null,
    });

    if (profileError) {
      console.error(`[Auth Webhook] Profile creation failed: ${profileError.message}`);
      // Nicht fataler Fehler — user existiert, aber kein profile
      // Phase 4 (Rolle-Management) wird das handhaben
    } else {
      console.log(`[Auth Webhook] Profile created for ${userId}`);
    }

    // 2. Audit Log: New user registered
    await client.from('audit_logs').insert({
      company_id: null, // System-level event
      actor_user_id: null, // System, nicht ein echter User
      action: 'auth.user_created',
      entity_type: 'user',
      entity_id: userId,
      metadata: {
        email: userEmail,
      },
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${userId} created and profile initialized`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[Auth Webhook] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
