import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getAuthStorageKey(url: string | undefined) {
  if (!url) return "imobitec-auth-token";

  try {
    const projectRef = new URL(url).hostname.split(".")[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return "imobitec-auth-token";
  }
}

const authStorageKey = getAuthStorageKey(supabaseUrl);

const sessionStorageAdapter = {
  getItem(key: string) {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  },
};

if (typeof window !== "undefined") {
  // Remove sessão persistente criada pela configuração anterior.
  window.localStorage.removeItem(authStorageKey);
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublicKey,
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublicKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: sessionStorageAdapter,
        storageKey: authStorageKey,
      },
    })
  : null;
