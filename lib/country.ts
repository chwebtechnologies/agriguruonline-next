import { isSupportedCountry, type Country } from "react-phone-number-input";
import en from "react-phone-number-input/locale/en.json";

const countryNames = en as Record<string, string>;

// Comprehensive mapping from IANA timezones to ISO 3166-1 alpha-2 country codes
const TIMEZONE_TO_COUNTRY: Record<string, Country> = {
  // India
  "Asia/Calcutta": "IN",
  "Asia/Kolkata": "IN",

  // United Arab Emirates
  "Asia/Dubai": "AE",

  // Gulf & Middle East
  "Asia/Riyadh": "SA",
  "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW",
  "Asia/Muscat": "OM",
  "Asia/Bahrain": "BH",
  "Asia/Aden": "YE",
  "Asia/Amman": "JO",
  "Asia/Beirut": "LB",
  "Asia/Damascus": "SY",
  "Asia/Baghdad": "IQ",
  "Asia/Jerusalem": "IL",
  "Asia/Tehran": "IR",

  // South Asia
  "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD",
  "Asia/Colombo": "LK",
  "Asia/Kathmandu": "NP",
  "Asia/Thimphu": "BT",
  "Asia/Kabul": "AF",

  // Southeast & East Asia
  "Asia/Singapore": "SG",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Saigon": "VN",
  "Asia/Jakarta": "ID",
  "Asia/Pontianak": "ID",
  "Asia/Makassar": "ID",
  "Asia/Jayapura": "ID",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Kuching": "MY",
  "Asia/Manila": "PH",
  "Asia/Shanghai": "CN",
  "Asia/Chongqing": "CN",
  "Asia/Harbin": "CN",
  "Asia/Urumqi": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Pyongyang": "KP",
  "Asia/Yangon": "MM",
  "Asia/Phnom_Penh": "KH",
  "Asia/Vientiane": "LA",
  "Asia/Brunei": "BN",

  // United States
  "America/New_York": "US",
  "America/Detroit": "US",
  "America/Kentucky/Louisville": "US",
  "America/Kentucky/Monticello": "US",
  "America/Indiana/Indianapolis": "US",
  "America/Indiana/Vincennes": "US",
  "America/Indiana/Winamac": "US",
  "America/Indiana/Marengo": "US",
  "America/Indiana/Petersburg": "US",
  "America/Indiana/Vevay": "US",
  "America/Indiana/Tell_City": "US",
  "America/Indiana/Knox": "US",
  "America/Chicago": "US",
  "America/North_Dakota/Center": "US",
  "America/North_Dakota/New_Salem": "US",
  "America/North_Dakota/Beulah": "US",
  "America/Denver": "US",
  "America/Boise": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "America/Juneau": "US",
  "America/Sitka": "US",
  "America/Metlakatla": "US",
  "America/Yakutat": "US",
  "America/Nome": "US",
  "America/Adak": "US",
  "Pacific/Honolulu": "US",

  // Canada
  "America/Toronto": "CA",
  "America/Montreal": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/St_Johns": "CA",
  "America/Regina": "CA",
  "America/Swift_Current": "CA",

  // United Kingdom & Ireland
  "Europe/London": "GB",
  "Europe/Belfast": "GB",
  "Europe/Dublin": "IE",

  // Western & Central Europe
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Busingen": "DE",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Africa/Ceuta": "ES",
  "Atlantic/Canary": "ES",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Budapest": "HU",
  "Europe/Bucharest": "RO",
  "Europe/Athens": "GR",
  "Europe/Lisbon": "PT",
  "Atlantic/Madeira": "PT",
  "Atlantic/Azores": "PT",
  "Europe/Istanbul": "TR",
  "Europe/Moscow": "RU",
  "Europe/Kyiv": "UA",

  // Australia & New Zealand
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Australia/Hobart": "AU",
  "Australia/Darwin": "AU",
  "Australia/Lord_Howe": "AU",
  "Pacific/Auckland": "NZ",
  "Pacific/Chatham": "NZ",

  // Africa
  "Africa/Cairo": "EG",
  "Africa/Johannesburg": "ZA",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Casablanca": "MA",
  "Africa/Accra": "GH",
  "Africa/Addis_Ababa": "ET",
  "Africa/Tunis": "TN",
  "Africa/Algiers": "DZ",

  // Latin America
  "America/Sao_Paulo": "BR",
  "America/Fortaleza": "BR",
  "America/Recife": "BR",
  "America/Bahia": "BR",
  "America/Belem": "BR",
  "America/Manaus": "BR",
  "America/Cuiaba": "BR",
  "America/Porto_Velho": "BR",
  "America/Boa_Vista": "BR",
  "America/Rio_Branco": "BR",
  "America/Mexico_City": "MX",
  "America/Cancun": "MX",
  "America/Merida": "MX",
  "America/Monterrey": "MX",
  "America/Mazatlan": "MX",
  "America/Chihuahua": "MX",
  "America/Hermosillo": "MX",
  "America/Tijuana": "MX",
  "America/Buenos_Aires": "AR",
  "America/Santiago": "CL",
  "America/Bogota": "CO",
  "America/Lima": "PE",
};

const STORAGE_KEY = "ag_detected_country";

/**
 * Returns human-readable country name from ISO country code.
 * E.g. "IN" -> "India", "AE" -> "United Arab Emirates"
 */
export function getCountryName(code?: Country | string): string {
  if (!code) return "this country";
  return countryNames[code] || code;
}

/**
 * Synchronously detects the user's country on client-side:
 * 1. Checks cached value in sessionStorage
 * 2. Checks IANA timezone from Intl.DateTimeFormat()
 * 3. Checks browser locale / navigator.language (e.g. en-IN -> IN)
 * 4. Fallback to "IN" (default for users in India)
 */
export function getDefaultUserCountry(): Country {
  if (typeof window === "undefined") {
    return "IN";
  }

  // 1. Check cached session storage
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached && isSupportedCountry(cached)) {
      return cached as Country;
    }
  } catch {}

  // 2. Detect from IANA Timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      const detected = TIMEZONE_TO_COUNTRY[tz];
      try {
        sessionStorage.setItem(STORAGE_KEY, detected);
      } catch {}
      return detected;
    }
  } catch {}

  // 3. Detect from navigator.language / navigator.languages (e.g. "en-IN", "hi-IN", "en-AE")
  try {
    const navLangs = navigator.languages || [navigator.language];
    for (const lang of navLangs) {
      if (!lang) continue;
      const match = lang.match(/[-_]([A-Za-z]{2})$/);
      if (match && match[1]) {
        const candidate = match[1].toUpperCase();
        if (isSupportedCountry(candidate)) {
          const detected = candidate as Country;
          try {
            sessionStorage.setItem(STORAGE_KEY, detected);
          } catch {}
          return detected;
        }
      }
    }
  } catch {}

  return "IN";
}

/**
 * Asynchronously checks /api/geo or network header to refine country detection if available.
 */
export async function fetchGeoCountry(): Promise<Country | null> {
  if (typeof window === "undefined") return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("/api/geo", { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.country && isSupportedCountry(data.country)) {
      const detected = data.country as Country;
      try {
        sessionStorage.setItem(STORAGE_KEY, detected);
      } catch {}
      return detected;
    }
  } catch {}

  return null;
}
