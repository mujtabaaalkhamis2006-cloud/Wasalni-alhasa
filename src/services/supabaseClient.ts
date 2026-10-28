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

  const isDummyUrl = cleanUrl === 'https://supabase.co' || cleanUrl === 'http://supabase.co' || cleanUrl.endsWith('//supabase.co');
  const isValidUrl = cleanUrl.startsWith('http') && !isDummyUrl;

  return {
    url: cleanUrl,
    anonKey: cleanKey,
    isConfigured: Boolean(isValidUrl && cleanKey)
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
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 25
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
      localStorage.setItem(
        SUPABASE_LOCAL_STORAGE_KEY,
        JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
      );
    }
    cachedClient = null;
    return true;
  } catch {
    return false;
  }
}

// ---------------- Database Table Helper Operations ----------------

/**
 * Persists a user account into Supabase 'transit_users' table.
 */
export async function saveUserToSupabaseDb(user: any, password?: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !user || !user.id) return false;

  try {
    const row: Record<string, any> = {
      id: user.id,
      name: user.name,
      phone: (user.phone || '').trim(),
      email: (user.email || '').toLowerCase().trim(),
      role: user.role,
      status: user.status || 'active',
      bus_details: user.busDetails || null,
      updated_at: new Date().toISOString()
    };

    if (password) {
      row.password = password.trim();
    }
    if (user.createdAt) {
      row.created_at = user.createdAt;
    }

    const { error } = await supabase.from('transit_users').upsert(row);
    if (error) {
      console.warn('transit_users upsert warning (table may need creation):', error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Queries Supabase 'transit_users' table by email or phone for cross-device authentication.
 */
export async function findUserInSupabaseDb(identifier: string): Promise<any | null> {
  const supabase = getSupabase();
  if (!supabase || !identifier) return null;

  const clean = identifier.trim().toLowerCase();

  try {
    // Try by email first
    const { data: byEmail, error: errEmail } = await supabase
      .from('transit_users')
      .select('*')
      .ilike('email', clean)
      .maybeSingle();

    if (!errEmail && byEmail) {
      return byEmail;
    }

    // Try by phone
    const { data: byPhone, error: errPhone } = await supabase
      .from('transit_users')
      .select('*')
      .eq('phone', identifier.trim())
      .maybeSingle();

    if (!errPhone && byPhone) {
      return byPhone;
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Loads all users from Supabase 'transit_users' table.
 */
export async function fetchAllUsersFromSupabaseDb(): Promise<any[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('transit_users')
      .select('*');

    if (!error && Array.isArray(data)) {
      return data;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Persists the entire application state snapshot in Supabase 'transit_state' table.
 */
export async function saveStateToSupabaseDb(state: any): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !state) return false;

  try {
    const { error } = await supabase
      .from('transit_state')
      .upsert({
        id: 'global_state',
        data: state,
        updated_at: new Date().toISOString()
      });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches the global state snapshot from Supabase 'transit_state' table.
 */
export async function fetchStateFromSupabaseDb(): Promise<any | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('transit_state')
      .select('data')
      .eq('id', 'global_state')
      .maybeSingle();

    if (!error && data?.data) {
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Deletes a user from Supabase 'transit_users' table.
 */
export async function deleteUserFromSupabaseDb(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !userId) return false;

  try {
    const { error } = await supabase
      .from('transit_users')
      .delete()
      .eq('id', userId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Deletes a trip from Supabase 'transit_trips' table if it exists.
 */
export async function deleteTripFromSupabaseDb(tripId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !tripId) return false;

  try {
    await supabase.from('transit_trips').delete().eq('id', tripId);
    return true;
  } catch {
    return false;
  }
}
