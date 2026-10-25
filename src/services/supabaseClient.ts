import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

const SUPABASE_LOCAL_STORAGE_KEY = 'al_ahsa_supabase_override';

export function getSupabaseConfig(): SupabaseConfig {
  // Check localStorage override first (for easy in-app testing if needed)
  let localUrl = '';
  let localAnon = '';
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(SUPABASE_LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        localUrl = parsed.url || '';
        localAnon = parsed.anonKey || '';
      }
    } catch {}
  }

  // Priority 1: Injected at build time by Vite (from Vercel SUPABASE_URL / SUPABASE_ANON_KEY)
  const url =
    localUrl ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    (import.meta.env?.SUPABASE_URL as string) ||
    (import.meta.env?.VITE_SUPABASE_URL as string) ||
    (typeof window !== 'undefined' && (window as any).__SUPABASE_URL) ||
    '';

  const anonKey =
    localAnon ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
    (import.meta.env?.SUPABASE_ANON_KEY as string) ||
    (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) ||
    (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY) ||
    '';

  const cleanUrl = (url || '').trim();
  const cleanKey = (anonKey || '').trim();

  return {
    url: cleanUrl,
    anonKey: cleanKey,
    isConfigured: Boolean(cleanUrl && cleanKey && cleanUrl.startsWith('http'))
  };
}

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return null;
  }

  if (cachedClient && lastUsedUrl === config.url && lastUsedKey === config.anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      realtime: {
        params: {
          eventsPerSecond: 20
        }
      }
    });
    lastUsedUrl = config.url;
    lastUsedKey = config.anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

export function setSupabaseConfigOverride(url: string, anonKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (!url || !anonKey) {
      localStorage.removeItem(SUPABASE_LOCAL_STORAGE_KEY);
    } else {
      localStorage.setItem(SUPABASE_LOCAL_STORAGE_KEY, JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }));
    }
    cachedClient = null;
    return true;
  } catch {
    return false;
  }
}
