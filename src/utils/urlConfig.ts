const STORAGE_KEY = 'alahsa_transit_share_url';

export const PRIMARY_STUDIO_URL = 'https://al-ahsa-buses-transit.ai.studio';
export const OFFICIAL_DOMAIN = PRIMARY_STUDIO_URL;

export const getSavedShareUrl = (): string => {
  if (typeof window === 'undefined') return PRIMARY_STUDIO_URL;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // ignore
  }
  return PRIMARY_STUDIO_URL;
};

export const setSavedShareUrl = (url: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const cleanUrl = url.trim();
    localStorage.setItem(STORAGE_KEY, cleanUrl);
    window.dispatchEvent(new CustomEvent('alahsa_url_updated', { detail: cleanUrl }));
  } catch {
    // ignore
  }
};
