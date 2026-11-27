import { readMediaFromIdb, writeMediaToIdb, deleteMediaFromIdb } from '../lib/mediaCacheDb';

// Official Incubadora Santander S.A. Company Logo
// Scalable, high-resolution vector SVG and Data URI for crisp rendering in Virtual PDF, Emails, and Print.

export const OFFICIAL_INCUBADORA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 84" width="310" height="84">
  <g fill="#14297e">
    <!-- Top Half of Egg -->
    <path d="M 28,3 C 14,3 2,17 1,35 C 1,39 3,42 7,42 C 14,42 24,38 34,32 C 43,26 48,19 48,12 C 48,6 40,3 28,3 Z" />
    <!-- Bottom Half of Egg with S Ribbon Curve -->
    <path d="M 2,47 C 0,55 2,65 9,72 C 16,79 26,80 34,79 C 45,76 54,64 54,46 C 54,40 52,36 47,36 C 40,36 30,40 20,46 C 11,52 6,59 6,66 C 6,70 10,73 16,73 C 24,73 32,67 36,58 L 43,62 C 38,73 28,78 16,78 C 6,78 0,72 0,63 C 0,53 8,45 19,39 C 29,33 39,29 46,30 C 51,31 56,36 56,44 C 56,66 45,82 32,82 C 22,82 12,78 5,69 C 1,63 -1,55 1,46 Z" />
  </g>
  <!-- Authentic Brand Typography -->
  <!-- Line 1: Incubadora -->
  <text x="64" y="38" font-family="'Arial Black', 'Trebuchet MS', 'Segoe UI', Impact, sans-serif" font-size="36" font-weight="900" font-style="italic" fill="#14297e" letter-spacing="-0.8px">Incubadora</text>
  <!-- Line 2: Santander S.A. -->
  <text x="64" y="72" font-family="'Arial Black', 'Trebuchet MS', 'Segoe UI', Impact, sans-serif" font-size="31" font-weight="900" font-style="italic" fill="#14297e" letter-spacing="-0.6px">Santander<tspan font-size="22" font-weight="900" font-style="italic" letter-spacing="-0.2px"> S.A.</tspan></text>
</svg>`;

export const COMPANY_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(OFFICIAL_INCUBADORA_LOGO_SVG)}`;

// Kept for backward compatibility
export const COMPANY_LOGO_BASE64 = COMPANY_LOGO_DATA_URL;
export const COMPANY_LOGO_STATIC_URL = '/incubadora-logo.png';
export const COMPANY_LOGO_STORAGE_KEY = 'kikes_custom_company_logo';
const IDB_COMPANY_LOGO_KEY = 'company_logo';

let memoryCompanyLogo: string | null = null;
let logoMutatedInSession = false;

function isValidImageString(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http') ||
    trimmed.startsWith('<svg') ||
    trimmed.startsWith('blob:')
  );
}

/**
 * Hydrates custom company logo from IndexedDB into memory on app startup.
 */
export async function hydrateCompanyLogo(): Promise<boolean> {
  try {
    const idbLogo = await readMediaFromIdb<string>(IDB_COMPANY_LOGO_KEY);
    if (logoMutatedInSession) return false;

    if (isValidImageString(idbLogo) && idbLogo !== COMPANY_LOGO_DATA_URL) {
      const changed = memoryCompanyLogo !== idbLogo;
      memoryCompanyLogo = idbLogo;
      return changed;
    }

    // Migrate existing localStorage custom logo into IndexedDB if present
    try {
      const lsLogo = localStorage.getItem(COMPANY_LOGO_STORAGE_KEY);
      if (isValidImageString(lsLogo) && lsLogo !== COMPANY_LOGO_DATA_URL) {
        memoryCompanyLogo = lsLogo;
        void writeMediaToIdb(IDB_COMPANY_LOGO_KEY, lsLogo);
      }
    } catch {
      // Ignore localStorage access errors
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns the active company logo (either custom uploaded from Personalización or system default)
 */
export function getCompanyLogo(): string {
  if (isValidImageString(memoryCompanyLogo)) {
    return memoryCompanyLogo;
  }
  try {
    const custom = localStorage.getItem(COMPANY_LOGO_STORAGE_KEY);
    if (isValidImageString(custom)) {
      memoryCompanyLogo = custom;
      return custom;
    }
  } catch (e) {
    console.warn('Error reading custom company logo from localStorage:', e);
  }
  return COMPANY_LOGO_DATA_URL;
}

/**
 * Saves a custom company logo data URL safely (memory + IndexedDB + best-effort localStorage)
 */
export function saveCompanyLogo(dataUrl: string): void {
  if (!isValidImageString(dataUrl) || dataUrl === COMPANY_LOGO_DATA_URL) {
    resetCompanyLogo();
    return;
  }
  logoMutatedInSession = true;
  memoryCompanyLogo = dataUrl;
  void writeMediaToIdb(IDB_COMPANY_LOGO_KEY, dataUrl);

  try {
    if (dataUrl.length <= 450_000) {
      localStorage.setItem(COMPANY_LOGO_STORAGE_KEY, dataUrl);
    } else {
      localStorage.removeItem(COMPANY_LOGO_STORAGE_KEY);
    }
  } catch {
    try {
      localStorage.removeItem(COMPANY_LOGO_STORAGE_KEY);
    } catch {
      // Ignore localStorage quota error since IndexedDB + memory already hold the logo
    }
  }
}

/**
 * Resets the company logo to the default Incubadora Santander logo
 */
export function resetCompanyLogo(): void {
  logoMutatedInSession = true;
  memoryCompanyLogo = null;
  void deleteMediaFromIdb(IDB_COMPANY_LOGO_KEY);
  try {
    localStorage.removeItem(COMPANY_LOGO_STORAGE_KEY);
  } catch (e) {
    console.error('Error resetting company logo:', e);
  }
}

/**
 * Checks if a custom company logo is currently set
 */
export function hasCustomCompanyLogo(): boolean {
  try {
    const current = getCompanyLogo();
    return Boolean(current && current.trim() !== '' && current !== COMPANY_LOGO_DATA_URL);
  } catch {
    return false;
  }
}

export const renderIncubadoraLogoHtml = (heightPx: number = 48): string => {
  const activeLogo = getCompanyLogo();
  return `
    <div style="display: inline-flex; align-items: center; justify-content: flex-start; flex-shrink: 0; height: ${heightPx}px;">
      <img
        src="${activeLogo}"
        alt="Incubadora Santander S.A."
        style="height: ${heightPx}px; max-height: ${heightPx}px; width: auto; max-width: 170px; display: block; border: 0; outline: none; object-fit: contain;"
      />
    </div>
  `;
};

export const getIncubadoraLogoDataUrl = (): string => {
  return getCompanyLogo();
};
