"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, FormEvent, KeyboardEvent } from "react";
import { CheckIcon, ChevronIcon } from "@/components/icons";

export type FilterDropdownOption = {
  label: string;
  value: string;
};

export function FilterDropdown({
  id,
  label,
  ariaLabel,
  value,
  options,
  onChange,
  adornment,
  wideMenu = false,
  searchable = false,
  searchPlaceholder = "Search options…",
  emptyMessage = "No options found.",
  variant = "storefront",
  compact = false,
  disabled = false,
  name,
  required = false,
  ariaInvalid = false,
  ariaDescribedBy,
  placeholder,
}: {
  id: string;
  label?: string;
  ariaLabel?: string;
  value: string;
  options: FilterDropdownOption[];
  onChange: (value: string) => void;
  adornment?: string;
  wideMenu?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  variant?: "storefront" | "admin";
  compact?: boolean;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const typeaheadRef = useRef({ query: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState<CSSProperties | null>(null);
  const visibleOptions = searchable && query.trim()
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : options;
  const selectedIndex = Math.max(0, visibleOptions.findIndex((option) => option.value === value));
  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label ?? placeholder ?? "";
  const menuReady = variant !== "admin" || Boolean(menuPosition);
  const labelId = label ? `${id}-label` : undefined;
  const valueId = `${id}-value`;
  const listId = `${id}-options`;

  useEffect(() => {
    if (!open || !menuReady) return;
    if (searchable) searchRef.current?.focus();
    else optionRefs.current[activeIndex]?.focus();
  }, [open, searchable, menuReady]);

  useEffect(() => {
    if (!open || !menuReady || (searchable && document.activeElement === searchRef.current)) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open, searchable, menuReady]);

  useEffect(() => {
    if (!open || variant !== "admin") return;
    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const desiredHeight = Math.min(360, visibleOptions.length * 40 + (searchable ? 58 : 14));
      const roomBelow = window.innerHeight - rect.bottom - 16;
      const roomAbove = rect.top - 16;
      const openAbove = roomBelow < Math.min(desiredHeight, 220) && roomAbove > roomBelow;
      const availableSpace = Math.max(96, openAbove ? roomAbove : roomBelow);
      const maxHeight = Math.min(360, availableSpace);
      const panelHeight = Math.min(desiredHeight, maxHeight);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8));
      const top = openAbove
        ? Math.max(8, rect.top - panelHeight - 7)
        : Math.min(window.innerHeight - panelHeight - 8, rect.bottom + 7);
      setMenuPosition({ position: "fixed", zIndex: 90, top, left, width: Math.min(rect.width, window.innerWidth - 16), maxHeight, visibility: "visible" });
    };
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, searchable, variant, visibleOptions.length]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const openOptions = (index = selectedIndex) => {
    setQuery("");
    setActiveIndex(Math.max(0, Math.min(options.length - 1, index)));
    setOpen(true);
  };

  const closeOptions = (restoreFocus = false) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const chooseOption = (option: FilterDropdownOption) => {
    onChange(option.value);
    closeOptions(true);
  };

  const focusOption = (index: number) => {
    const nextIndex = Math.max(0, Math.min(visibleOptions.length - 1, index));
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(visibleOptions.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeOptions(true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) chooseOption(option);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const previous = typeaheadRef.current;
      const query = now - previous.time < 700 ? `${previous.query}${event.key}` : event.key;
      typeaheadRef.current = { query: query.toLocaleLowerCase(), time: now };
      const matchIndex = visibleOptions.findIndex((option) => option.label.toLocaleLowerCase().startsWith(typeaheadRef.current.query));
      if (matchIndex >= 0) focusOption(matchIndex);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(visibleOptions.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeOptions(true);
    } else if (event.key === "Enter" && visibleOptions.length === 1) {
      event.preventDefault();
      chooseOption(visibleOptions[0]);
    }
  };

  const handleInvalid = (event: FormEvent<HTMLSelectElement>) => {
    event.preventDefault();
    triggerRef.current?.focus();
  };

  const rootClass = variant === "admin" ? "rv-select-dropdown" : "filter-field filter-field--dropdown";
  const usePortal = variant === "admin" && open && typeof document !== "undefined";
  const menu = (
    <div
      ref={menuRef}
      className={`filter-dropdown__menu${wideMenu ? " filter-dropdown__menu--wide" : ""}${variant === "admin" ? " rv-select-dropdown__menu" : ""}`}
      style={usePortal ? menuPosition ?? { position: "fixed", top: 0, left: 0, visibility: "hidden" } : undefined}
      hidden={!open}
    >
      {searchable ? (
        <input
          ref={searchRef}
          className={`filter-dropdown__search${variant === "admin" ? " rv-select-dropdown__search" : ""}`}
          type="search"
          value={query}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          aria-controls={listId}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
          onKeyDown={handleSearchKeyDown}
        />
      ) : null}
      <div
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        aria-label={label ? undefined : ariaLabel}
        onKeyDown={handleListKeyDown}
      >
        {visibleOptions.length ? visibleOptions.map((option, index) => {
          const selected = option.value === value;
          return (
            <div
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              id={`${id}-option-${index}`}
              className={`filter-dropdown__option${variant === "admin" ? " rv-select-dropdown__option" : ""}${selected ? " is-selected" : ""}${activeIndex === index ? " is-active" : ""}`}
              role="option"
              aria-selected={selected}
              tabIndex={-1}
              onFocus={() => setActiveIndex(index)}
              onClick={() => chooseOption(option)}
            >
              <span>{option.label}</span>
              <span className="filter-dropdown__check"><CheckIcon size={14} /></span>
            </div>
          );
        }) : <p className={`filter-dropdown__empty${variant === "admin" ? " rv-select-dropdown__empty" : ""}`}>{emptyMessage}</p>}
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`${rootClass}${compact ? ` ${variant === "admin" ? "rv-select-dropdown--compact" : "filter-dropdown--compact"}` : ""}${open ? " is-open" : ""}`}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && !menuRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {label ? <label id={labelId} htmlFor={id} className={variant === "admin" ? "rv-label rv-select-dropdown__label" : "filter-field__dropdown-label"}>{label}</label> : null}
      {name || required ? (
        <select
          className="filter-dropdown__native"
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onInvalid={handleInvalid}
          onChange={(event) => onChange(event.target.value)}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : null}
      <div className="filter-dropdown__control">
        {adornment ? <span className="filter-dropdown__adornment" aria-hidden="true">{adornment}</span> : null}
        <button
          ref={triggerRef}
          id={id}
          className={`filter-dropdown__trigger${variant === "admin" ? " rv-select" : ""}${adornment ? " has-adornment" : ""}`}
          type="button"
          aria-label={ariaLabel}
          aria-labelledby={labelId ? `${labelId} ${valueId}` : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          onClick={() => {
            if (open) closeOptions();
            else openOptions();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              openOptions(event.key === "ArrowUp" ? Math.max(0, selectedIndex - 1) : selectedIndex);
            }
          }}
        >
          <span id={valueId} className="filter-dropdown__value">{selectedLabel}</span>
          <span className="filter-dropdown__chevron" aria-hidden="true">
            <ChevronIcon size={16} />
          </span>
        </button>
        {usePortal ? createPortal(menu, document.body) : menu}
      </div>
    </div>
  );
}
