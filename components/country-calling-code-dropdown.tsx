"use client";

import { useMemo } from "react";
import { FilterDropdown, type FilterDropdownOption } from "@/components/filter-dropdown";
import { COUNTRY_CALLING_CODES, countryFlagEmoji } from "@/lib/country-calling-codes";
import { COUNTRY_CODES, countryNameForCode } from "@/lib/countries";

const extraRegionNames: Readonly<Record<string, { en: string; id: string }>> = {
  AC: { en: "Ascension Island", id: "Pulau Ascension" },
  TA: { en: "Tristan da Cunha", id: "Tristan da Cunha" },
  XK: { en: "Kosovo", id: "Kosovo" },
};

export function CountryCallingCodeDropdown({
  id,
  value,
  onChange,
  locale = "en",
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  locale?: string;
  ariaLabel: string;
}) {
  const options = useMemo(() => {
    const regions = [...new Set([...COUNTRY_CODES, ...Object.keys(COUNTRY_CALLING_CODES)])];
    return regions.flatMap((region): FilterDropdownOption[] => {
      const callingCode = COUNTRY_CALLING_CODES[region];
      if (!callingCode) return [];
      const name = countryNameForCode(region, locale) ?? extraRegionNames[region]?.[locale.startsWith("id") ? "id" : "en"] ?? region;
      const flag = countryFlagEmoji(region);
      return [{
        value: region,
        label: `${flag} ${name} (+${callingCode})`,
        triggerLabel: `${flag} +${callingCode}`,
      }];
    }).sort((left, right) => left.label.localeCompare(right.label, locale));
  }, [locale]);

  return <FilterDropdown
    id={id}
    ariaLabel={ariaLabel}
    value={value}
    onChange={onChange}
    options={options}
    searchable
    searchPlaceholder={locale.startsWith("id") ? "Cari negara atau kode…" : "Search country or code…"}
    emptyMessage={locale.startsWith("id") ? "Kode negara tidak ditemukan." : "No calling code found."}
    name="phoneCountry"
    required
  />;
}
