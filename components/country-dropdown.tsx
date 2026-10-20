"use client";

import { useMemo } from "react";
import { FilterDropdown, type FilterDropdownOption } from "@/components/filter-dropdown";
import { COUNTRY_CODES, OTHER_COUNTRY_VALUE, WORLDWIDE_REGION_VALUE, countryNameForCode } from "@/lib/countries";

type CountryDropdownProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  locale?: string;
  variant?: "storefront" | "admin";
  name?: string;
  required?: boolean;
  disabled?: boolean;
  includeWorldwide?: boolean;
  includeOther?: boolean;
  ariaLabel?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  placeholder?: string;
};

export function CountryDropdown({
  id,
  value,
  onChange,
  locale = "en",
  variant = "storefront",
  name,
  required = false,
  disabled = false,
  includeWorldwide = false,
  includeOther = false,
  ariaLabel,
  searchPlaceholder,
  emptyMessage,
  placeholder,
}: CountryDropdownProps) {
  const options = useMemo(() => {
    const countryOptions: FilterDropdownOption[] = COUNTRY_CODES.map((code) => ({
      value: code,
      label: countryNameForCode(code, locale) ?? code,
    })).sort((left, right) => left.label.localeCompare(right.label, locale));

    const result: FilterDropdownOption[] = [];
    if (includeWorldwide) result.push({ value: WORLDWIDE_REGION_VALUE, label: locale.startsWith("id") ? "Seluruh dunia" : "Worldwide" });
    result.push(...countryOptions);
    if (includeOther) result.push({ value: OTHER_COUNTRY_VALUE, label: locale.startsWith("id") ? "Negara lain" : "Other" });

    if (value && !result.some((option) => option.value === value)) {
      result.push({ value, label: value });
    }
    return result;
  }, [includeOther, includeWorldwide, locale, value]);

  return (
    <FilterDropdown
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      variant={variant}
      searchable
      searchPlaceholder={searchPlaceholder ?? (locale.startsWith("id") ? "Cari negara…" : "Search countries…")}
      emptyMessage={emptyMessage ?? (locale.startsWith("id") ? "Negara tidak ditemukan." : "No country found.")}
      ariaLabel={ariaLabel}
      name={name}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
