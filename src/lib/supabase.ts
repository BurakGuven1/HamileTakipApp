import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/config/env";
import type { Database } from "@/types/database";

const fallbackSupabaseUrl = "https://example.supabase.co";
const fallbackSupabaseAnonKey = "missing-anon-key";
const isWebServer = Platform.OS === "web" && typeof window === "undefined";

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey
);

const secureStorageAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === "web") {
      if (isWebServer) return Promise.resolve(null);
      return AsyncStorage.getItem(key);
    }

    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (isWebServer) return Promise.resolve();
      return AsyncStorage.setItem(key, value);
    }

    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === "web") {
      if (isWebServer) return Promise.resolve();
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
      autoRefreshToken: !isWebServer,
      detectSessionInUrl: false,
      persistSession: !isWebServer,
      storage: secureStorageAdapter
    }
  }
);
