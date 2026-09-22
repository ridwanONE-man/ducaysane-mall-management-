import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lxhtljypbkpomqcvzjdp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4aHRsanlwYmtwb21xY3Z6amRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTU0MjYsImV4cCI6MjEwNTYzMTQyNn0.jT1xU1JGfD-cXmPMhkqzHSyNVfyl68Tr4ruUxVTsb5I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
