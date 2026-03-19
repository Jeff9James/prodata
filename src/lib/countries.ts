/**
 * Shared country code utilities.
 *
 * All country data stored in the database uses ISO 3166-1 alpha-2 codes
 * (e.g. "US", "DE", "BR"). This module provides:
 *
 * - `resolveCountryCode(name)` — convert a display name like "United States"
 *   to its alpha-2 code. Works with all major name variants across APIs.
 * - `getCountryName(code)` — convert an alpha-2 code to its English name.
 * - `isValidCountryCode(code)` — check if a string is a valid alpha-2 code.
 *
 * Backed by `i18n-iso-countries` (comprehensive ISO 3166-1 database) with a
 * small set of manual overrides for names that external APIs (RevenueCat, etc.)
 * use but the library doesn't recognize.
 */

import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

// Register English locale — the only one we need for name resolution
countries.registerLocale(enLocale);

// ─── Name → Code overrides ─────────────────────────────────────────────────
//
// These cover name variants used by external APIs (primarily RevenueCat v3)
// that `i18n-iso-countries` doesn't map. The library handles most standard
// names, but some APIs return formal UN-style names, obsolete forms, or
// non-standard abbreviations.
//
// Keys MUST be lowercase. Values are ISO 3166-1 alpha-2 codes.

const NAME_OVERRIDES: Record<string, string> = {
  // UN formal names that the library doesn't reverse-map
  "viet nam": "VN",
  "iran, islamic republic of": "IR",
  "congo, the democratic republic of the": "CD",
  "bolivia, plurinational state of": "BO",
  "venezuela, bolivarian republic of": "VE",
  "tanzania, united republic of": "TZ",
  "palestine, state of": "PS",
  "korea, republic of": "KR",
  "russian federation": "RU",
  "palestinian territory, occupied": "PS",
  "lao people's democratic republic": "LA",
  "micronesia, federated states of": "FM",
  "congo, republic of the": "CG",
  "virgin islands, british": "VG",
  "virgin islands, u.s.": "VI",
  "saint martin (french part)": "MF",
  "sint maarten (dutch part)": "SX",

  // Common short names the library might miss
  "south korea": "KR",
  "north korea": "KP",
  "ivory coast": "CI",
  "east timor": "TL",
  "cape verde": "CV",
  "the bahamas": "BS",
  "the gambia": "GM",

  // Sentinel value used by some APIs for unknown/unresolved countries
  "unknown": "Unknown",
};

/**
 * Resolve a country display name to its ISO 3166-1 alpha-2 code.
 *
 * Handles:
 * - Standard English names ("United States" → "US")
 * - Formal UN names ("Iran, Islamic Republic of" → "IR")
 * - Common short names ("South Korea" → "KR")
 * - Already-valid alpha-2 codes passed through ("US" → "US")
 *
 * Returns the raw input if no mapping is found (so the caller can decide
 * how to handle unknown names).
 */
export function resolveCountryCode(name: string): string {
  if (!name) return "Unknown";

  const trimmed = name.trim();

  // Fast path: if it's already a valid 2-letter ISO code, return it uppercased
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    if (countries.isValid(upper) || upper === "XK") {
      return upper;
    }
  }

  // Check manual overrides first (they take priority for edge cases)
  const overrideCode = NAME_OVERRIDES[trimmed.toLowerCase()];
  if (overrideCode) return overrideCode;

  // Use the library's name → alpha2 lookup
  const libraryCode = countries.getAlpha2Code(trimmed, "en");
  if (libraryCode) return libraryCode;

  // Fallback: strip diacritics and retry.
  // Handles accented names like "Réunion" → "Reunion", "Côte d'Ivoire", etc.
  const stripped = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (stripped !== trimmed) {
    const strippedCode = countries.getAlpha2Code(stripped, "en");
    if (strippedCode) return strippedCode;
  }

  // Last resort: return the input as-is
  return trimmed;
}

/**
 * Get the English display name for an ISO 3166-1 alpha-2 country code.
 *
 * Returns the code itself if no name is found (e.g. "Unknown", "Other",
 * or invalid codes).
 */
export function getCountryName(code: string): string {
  if (!code || code === "Unknown" || code === "Other") return code;
  return countries.getName(code, "en") ?? code;
}

/**
 * Check whether a string is a valid ISO 3166-1 alpha-2 country code.
 * Also accepts "XK" (Kosovo, widely used but not in the official standard).
 */
export function isValidCountryCode(code: string): boolean {
  if (!code || code.length !== 2) return false;
  const upper = code.toUpperCase();
  return countries.isValid(upper) || upper === "XK";
}

/**
 * Get approximate latitude/longitude coordinates for a country from its ISO 3166-1 alpha-2 code.
 * Used for plotting sales on the world map.
 */
export function getCountryCoordinates(code: string): { lat: number; lng: number } | null {
  const coordinates: Record<string, { lat: number; lng: number }> = {
    // North America
    US: { lat: 37.0902, lng: -95.7129 }, // United States
    CA: { lat: 56.1304, lng: -106.3468 }, // Canada
    MX: { lat: 23.6345, lng: -102.5528 }, // Mexico

    // South America
    BR: { lat: -14.2350, lng: -51.9253 }, // Brazil
    AR: { lat: -38.4161, lng: -63.6167 }, // Argentina
    CO: { lat: 4.5709, lng: -74.2973 }, // Colombia

    // Europe
    GB: { lat: 55.3781, lng: -3.4360 }, // United Kingdom
    FR: { lat: 46.2276, lng: 2.2137 }, // France
    DE: { lat: 51.1657, lng: 10.4515 }, // Germany
    IT: { lat: 41.8719, lng: 12.5674 }, // Italy
    ES: { lat: 40.4637, lng: -3.7492 }, // Spain
    RU: { lat: 61.5240, lng: 105.3188 }, // Russia
    NL: { lat: 52.1326, lng: 5.2913 }, // Netherlands
    BE: { lat: 50.5039, lng: 4.4699 }, // Belgium
    CH: { lat: 46.8182, lng: 8.2275 }, // Switzerland

    // Asia
    IN: { lat: 20.5937, lng: 78.9629 }, // India
    CN: { lat: 35.8617, lng: 104.1954 }, // China
    JP: { lat: 36.2048, lng: 138.2529 }, // Japan
    KR: { lat: 35.9078, lng: 127.7669 }, // South Korea
    SG: { lat: 1.3521, lng: 103.8198 }, // Singapore
    AU: { lat: -25.2744, lng: 133.7751 }, // Australia

    // Africa
    NG: { lat: 9.0820, lng: 8.6753 }, // Nigeria
    SA: { lat: -30.5595, lng: 22.9375 }, // South Africa
    KE: { lat: -0.0236, lng: 37.9062 }, // Kenya

    // Default coordinates (center of map)
    Unknown: { lat: 0, lng: 0 },
  };

  return coordinates[code.toUpperCase()] || coordinates["Unknown"];
}
