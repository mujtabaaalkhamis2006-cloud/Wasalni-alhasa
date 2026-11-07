const STORAGE_KEY = 'alahsa_transit_share_url';
const APK_STORAGE_KEY = 'alahsa_transit_apk_url';

export const PRIMARY_STUDIO_URL = 'https://al-ahsa-buses-transit.ai.studio';
export const OFFICIAL_DOMAIN = PRIMARY_STUDIO_URL;
export const DEFAULT_APK_URL = '';

let inMemoryShareUrl: string = PRIMARY_STUDIO_URL;
let inMemoryApkUrl: string = DEFAULT_APK_URL;

// Read from localStorage on module initialization if in browser
if (typeof window !== 'undefined') {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s && s.trim()) inMemoryShareUrl = s.trim();
    const a = localStorage.getItem(APK_STORAGE_KEY);
    if (a && a.trim()) inMemoryApkUrl = a.trim();
  } catch {}
}

export const getSavedShareUrl = (): string => {
  if (typeof window === 'undefined') return PRIMARY_STUDIO_URL;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return inMemoryShareUrl || PRIMARY_STUDIO_URL;
};

export const getSavedApkUrl = (): string => {
  if (typeof window === 'undefined') return DEFAULT_APK_URL;
  try {
    const saved = localStorage.getItem(APK_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return inMemoryApkUrl || DEFAULT_APK_URL;
};

export const setSavedShareUrl = (url: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const cleanUrl = url.trim();
    inMemoryShareUrl = cleanUrl;
    localStorage.setItem(STORAGE_KEY, cleanUrl);
    window.dispatchEvent(new CustomEvent('alahsa_url_updated', { detail: cleanUrl }));

    // 1. Post to Express Server for multi-device broadcast
    fetch('/api/transit/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareUrl: cleanUrl })
    }).catch(() => {});

    // 2. Trigger transitStore Realtime & MQTT broadcast across devices
    if ((window as any).__transitStore?.updateAppLinks) {
      (window as any).__transitStore.updateAppLinks({ shareUrl: cleanUrl });
    }
  } catch {}
};

export const setSavedApkUrl = (url: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const cleanUrl = url.trim();
    inMemoryApkUrl = cleanUrl;
    localStorage.setItem(APK_STORAGE_KEY, cleanUrl);
    window.dispatchEvent(new CustomEvent('alahsa_apk_url_updated', { detail: cleanUrl }));

    // 1. Post to Express Server for multi-device broadcast
    fetch('/api/transit/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apkUrl: cleanUrl })
    }).catch(() => {});

    // 2. Trigger transitStore Realtime & MQTT broadcast across devices
    if ((window as any).__transitStore?.updateAppLinks) {
      (window as any).__transitStore.updateAppLinks({ apkUrl: cleanUrl });
    }
  } catch {}
};

/**
 * Actively syncs share & APK download links from the server so that second and third devices
 * immediately reflect the admin's changes without manual reload.
 */
export const syncLinksWithRemote = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/transit/links');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.success) {
      if (typeof data.shareUrl === 'string' && data.shareUrl.trim()) {
        const cleanShare = data.shareUrl.trim();
        const currentShare = localStorage.getItem(STORAGE_KEY) || '';
        if (cleanShare !== currentShare) {
          inMemoryShareUrl = cleanShare;
          localStorage.setItem(STORAGE_KEY, cleanShare);
          window.dispatchEvent(new CustomEvent('alahsa_url_updated', { detail: cleanShare }));
        }
      }
      if (typeof data.apkUrl === 'string') {
        const cleanApk = data.apkUrl.trim();
        const currentApk = localStorage.getItem(APK_STORAGE_KEY) || '';
        if (cleanApk !== currentApk) {
          inMemoryApkUrl = cleanApk;
          localStorage.setItem(APK_STORAGE_KEY, cleanApk);
          window.dispatchEvent(new CustomEvent('alahsa_apk_url_updated', { detail: cleanApk }));
        }
      }
    }
  } catch {}
};

// Automatic Real-Time Synchronization Listener for Secondary Devices
if (typeof window !== 'undefined') {
  // Sync on startup
  syncLinksWithRemote();

  // Sync when user returns to app/tab
  window.addEventListener('focus', () => syncLinksWithRemote());
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncLinksWithRemote();
    }
  });

  // Fast periodic heartbeat sync across all devices (every 3 seconds)
  setInterval(() => {
    syncLinksWithRemote();
  }, 3000);
}
