import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest } from './handler.ts';

// SUPABASE_SECRET_KEYS est le dictionnaire des nouvelles clés secrètes.
// La clé historique ne sert que tant que les anciennes clés sont actives.
const secretKey = (): string => {
  try {
    const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
    if (key) return key;
  } catch {
    // Dictionnaire illisible : on se rabat sur la clé historique.
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
};

Deno.serve((req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return handleRequest(req, admin);
});
