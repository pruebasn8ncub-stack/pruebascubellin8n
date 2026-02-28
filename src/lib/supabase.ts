import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sdpxrgtqrpugatxkqyab.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcHhyZ3RxcnB1Z2F0eGtxeWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDUzODQsImV4cCI6MjA4NzY4MTM4NH0.lYSk4wnkHCzSXHq37aWkkwTN_URbycr405Wo1rfLjBk';

export const supabase = createClient(supabaseUrl, supabaseKey);
