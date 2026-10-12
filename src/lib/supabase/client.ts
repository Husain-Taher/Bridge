import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('placeholder-project') &&
    !supabaseAnonKey.includes('placeholder-anon-key')
  );
};

// Singleton browser client instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClientInstance: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getSupabaseClient = (): any => {
  if (!supabaseClientInstance) {
    const url = isSupabaseConfigured() ? supabaseUrl : 'https://dummy-bridge-demo.supabase.co';
    const key = isSupabaseConfigured() ? supabaseAnonKey : 'dummy-anon-key-placeholder';

    supabaseClientInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabaseClientInstance;
};
