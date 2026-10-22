import { COUNTRY_NAMES } from "@/lib/country-names";

export const OTHER_COUNTRY_VALUE = "__other__";
export const WORLDWIDE_REGION_VALUE = "Worldwide";

export const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(" ");

export function countryNameForCode(code: string, locale = "en"): string | null {
  const normalized = code.trim().toUpperCase();
  if (!COUNTRY_CODES.includes(normalized)) return null;
  const language = locale.toLowerCase().startsWith("id") ? "id" : "en";
  return COUNTRY_NAMES[language][normalized] ?? normalized;
}

const countryNameAliases: Record<string, string> = {
  "czech republic": "CZ",
  "south korea": "KR",
  "north korea": "KP",
  "ivory coast": "CI",
  "russia": "RU",
  "vatican city": "VA",
  "united states of america": "US",
  uk: "GB",
  el: "GR",
  "viet nam": "VN",
  "türkiye": "TR",
};

export function countryCodeForName(name: string | null | undefined): string | null {
  const value = name?.trim();
  if (!value) return null;
  const normalized = value.toLowerCase();
  const directCode = value.toUpperCase();
  if (COUNTRY_CODES.includes(directCode)) return directCode;
  if (countryNameAliases[normalized]) return countryNameAliases[normalized];

  for (const code of COUNTRY_CODES) {
    if (["en", "id-ID"].some((locale) => countryNameForCode(code, locale)?.toLowerCase() === normalized)) {
      return code;
    }
  }
  return null;
}
