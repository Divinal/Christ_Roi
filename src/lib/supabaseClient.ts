import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://blxxgukexlvkxrcrvoyt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHhndWtleGx2a3hyY3J2b3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNjAsImV4cCI6MjA4NDk1MzI2MH0.x7Bel44cz85pFhGVT4XIncqk0MItyfCKn7KzQLj3Zno'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
