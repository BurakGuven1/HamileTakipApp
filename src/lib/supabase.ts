import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/config/env";
import type { Database } from "@/types/database";

const fallbackSupabaseUrl = "https://example.supabase.co";
const fallbackSupabaseAnonKey = "missing-anon-key";

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey
);

const secureStorageAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === "web") {
      return AsyncStorage.getItem(key);
    }

    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === "web") {
      return AsyncStorage.setItem(key, value);
    }

    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === "web") {
      return AsyncStorage.removeItem(key);
    }

    return SecureStore.deleteItemAsync(key);
  }
};

export const supabase = createClient<Database>(
  env.supabaseUrl ?? fallbackSupabaseUrl,
  env.supabaseAnonKey ?? fallbackSupabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: secureStorageAdapter
    }
  }
);
