import { createClient } from '@supabase/supabase-js';

// Seule une clé publique a sa place ici : tout ce qui est dans ce fichier est
// envoyé aux visiteurs. Les opérations qui exigent une clé secrète passent par
// la fonction serveur admin-users (voir src/lib/adminUsers.ts).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublicKey) {
  throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY doivent être définies dans .env');
}

export const supabase = createClient(supabaseUrl, supabasePublicKey);
