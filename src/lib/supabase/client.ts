import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

const PERSIST_FLAG_KEY = "Pronutrition.persist";

function isPersistFlagSet(): boolean {
  try {
    return localStorage.getItem(PERSIST_FLAG_KEY) === "true";
  } catch {
    return false;
  }
}

const conditionalStorage: Required<Pick<Storage, "getItem" | "setItem" | "removeItem">> = {
  getItem(key: string): string | null {
    const storage = isPersistFlagSet() ? localStorage : sessionStorage;
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    const storage = isPersistFlagSet() ? localStorage : sessionStorage;
    try {
      storage.setItem(key, value);
    } catch {
      // quota exceeded ou private mode — ignora silenciosamente
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignora
    }
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignora
    }
  },
};

export function setSessionPersistence(persist: boolean): void {
  try {
    if (persist) {
      localStorage.setItem(PERSIST_FLAG_KEY, "true");
    } else {
      localStorage.removeItem(PERSIST_FLAG_KEY);
    }
  } catch {
    // ignora erro de storage
  }
}

export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: conditionalStorage,
  },
});
