// src/supabase/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

// It is best practice to store these in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://llmninjjqbqahdykaih.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsbW5pbmpqcWJxYWhkeWthaWgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc1MTg2MzcwNywiZXhwIjoyMDY3NDM5NzA3fQ.XjaGFoZhlrYWloTIiwicm9s'; // <-- Make sure to add the closing quote here!

export const supabase = createClient(supabaseUrl, supabaseAnonKey);