import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/config/env";
import type { Database } from "@/types/database";

const fallbackSupabaseUrl = "https://example.supabase.co";
const fallbackSupabaseAnonKey = "missing-anon-key";

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey
);

export const supabase = createClient<Database>(
  env.supabaseUrl ?? fallbackSupabaseUrl,
  env.supabaseAnonKey ?? fallbackSupabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: AsyncStorage
    }
  }
);
