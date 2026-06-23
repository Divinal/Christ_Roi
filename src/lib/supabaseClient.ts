import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qjdyxhcqfxrxgxjzbbth.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZHl4aGNxZnhyeGd4anpiYnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxOTIwMjksImV4cCI6MjA5Nzc2ODAyOX0.lTYgKsdEIr6HODEGz-cKow-mJ-tf9ZCv88kqvM2X4N8'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZHl4aGNxZnhyeGd4anpiYnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE5MjAyOSwiZXhwIjoyMDk3NzY4MDI5fQ.TlGA717GXUORsU6ZCNGKCl7C-V_F73pfLjJO3tFxNMc'; // ← AJOUTER

// Client normal (avec anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client admin (avec service role key) - POUR CRÉER DES UTILISATEURS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});