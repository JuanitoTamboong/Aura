// src/supabase/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llmninjjqbqhahdykaih.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsbW5pbmpqcWJxaGFoZHlrYWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MTQwNDQsImV4cCI6MjEwODM5MDA0NH0.jOiKV3Grwyep5hsuqJqT6FXuhsvruwCZuTbHFA7GivQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);