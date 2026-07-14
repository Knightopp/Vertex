import { createClient } from "@supabase/supabase-js";

// These are public keys and safe to expose in the client
const supabaseUrl = "https://fpzbupubmmryjjnyfear.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwemJ1cHVibW1yeWpqbnlmZWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MTczMTQsImV4cCI6MjA5OTQ5MzMxNH0.jqp0ptZyZq9pikRzDxYMuqP6gtTNK6v1J1KUf3nEUfs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
