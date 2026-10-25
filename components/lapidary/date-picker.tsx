"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Language } from "@/lib/i18n";

type DatePickerProps = {
  id: string;
  value: string;
  minDate: string;
  language: Language;
  onChange: (value: string) => void;
};

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
    ? date
    : null;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function shiftMonth(date: Date, amount: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay), 12);
}

function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function LapidaryDatePicker({ id, value, minDate, language, onChange }: DatePickerProps) {
  const isId = language === "id";
  const locale = isId ? "id-ID" : "en-GB";
  const labels = isId
    ? { choose: "Pilih tanggal", dialog: "Pilih tanggal penyelesaian", previous: "Bulan sebelumnya", next: "Bulan berikutnya", clear: "Hapus tanggal", today: "Pilih hari ini" }
    : { choose: "Choose a preferred date", dialog: "Choose a preferred completion date", previous: "Previous month", next: "Next month", clear: "Clear date", today: "Choose today" };
  const minimum = parseDateKey(minDate) ?? new Date();
  const selectedDate = parseDateKey(value);
  const initialDate = selectedDate && selectedDate >= minimum ? selectedDate : minimum;
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"above" | "below">("below");
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(initialDate));
  const [focusedDate, setFocusedDate] = useState(() => dateKey(initialDate));
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const firstDayOfWeek = isId ? 1 : 0;
  const monthYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(visibleMonth);
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
    const day = (firstDayOfWeek + index) % 7;
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2023, 0, 1 + day, 12));
  });
  const calendarDates = useMemo(() => {
    const first = monthStart(visibleMonth);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12).getDate();
    const offset = (first.getDay() - firstDayOfWeek + 7) % 7;
    const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const day = index - offset + 1;
      return day < 1 || day > daysInMonth ? null : new Date(first.getFullYear(), first.getMonth(), day, 12);
    });
  }, [visibleMonth, firstDayOfWeek]);

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(monthStart(selectedDate));
      setFocusedDate(value);
    }
  }, [selectedDate?.getTime(), value]);

  useEffect(() => {
    if (!open) return;
    dayRefs.current.get(focusedDate)?.focus();
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, focusedDate, calendarDates]);

  function openCalendar() {
    const start = selectedDate && selectedDate >= minimum ? selectedDate : minimum;
    const bounds = pickerRef.current?.getBoundingClientRect();
    const roomBelow = bounds ? window.innerHeight - bounds.bottom : window.innerHeight;
    setPlacement(bounds && roomBelow < 350 && bounds.top > roomBelow ? "above" : "below");
    setVisibleMonth(monthStart(start));
    setFocusedDate(dateKey(start));
    setOpen(true);
  }

  function selectDate(date: Date) {
    onChange(dateKey(date));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveTo(date: Date) {
    const next = date < minimum ? minimum : date;
    setVisibleMonth(monthStart(next));
    setFocusedDate(dateKey(next));
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    let next: Date | null = null;
    if (event.key === "ArrowLeft") next = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12);
    if (event.key === "ArrowRight") next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12);
    if (event.key === "ArrowUp") next = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7, 12);
    if (event.key === "ArrowDown") next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7, 12);
    if (event.key === "Home") next = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() - firstDayOfWeek + 7) % 7), 12);
    if (event.key === "End") next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (6 - (date.getDay() - firstDayOfWeek + 7) % 7), 12);
    if (event.key === "PageUp") next = shiftMonth(date, -1);
    if (event.key === "PageDown") next = shiftMonth(date, 1);
    if (!next) return;
    event.preventDefault();
    moveTo(next);
  }

  function changeMonth(amount: number) {
    const next = shiftMonth(visibleMonth, amount);
    const earliestMonth = monthStart(minimum);
    if (next < earliestMonth) return;
    const nextDate = sameMonth(next, visibleMonth)
      ? next
      : new Date(next.getFullYear(), next.getMonth(), 1, 12);
    moveTo(nextDate);
  }

  const selectedText = selectedDate
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(selectedDate)
    : "";
  const weeks = Array.from({ length: calendarDates.length / 7 }, (_, index) => calendarDates.slice(index * 7, index * 7 + 7));

  return (
    <div className="lapidary-date-picker" ref={pickerRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="lapidary-date-picker__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-calendar` : undefined}
        aria-describedby={`${id}-hint`}
        onClick={() => open ? setOpen(false) : openCalendar()}
      >
        <CalendarDays size={18} strokeWidth={1.7} aria-hidden="true" />
        <span className={selectedText ? "" : "is-placeholder"}>{selectedText || labels.choose}</span>
        <ChevronDown className="lapidary-date-picker__chevron" size={16} strokeWidth={1.7} aria-hidden="true" />
      </button>

      {open ? (
        <div id={`${id}-calendar`} className={`lapidary-date-picker__popover${placement === "above" ? " is-above" : ""}`} role="dialog" aria-label={labels.dialog}>
          <div className="lapidary-date-picker__header">
            <button type="button" aria-label={labels.previous} onClick={() => changeMonth(-1)} disabled={sameMonth(visibleMonth, minimum)}>
              <ChevronLeft size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <h4>{monthYear}</h4>
            <button type="button" aria-label={labels.next} onClick={() => changeMonth(1)}>
              <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <div className="lapidary-date-picker__grid" role="grid" aria-label={monthYear}>
            <div className="lapidary-date-picker__weekdays" role="row">
              {weekdayLabels.map((weekday, index) => <span role="columnheader" key={`${weekday}-${index}`}>{weekday}</span>)}
            </div>
            {weeks.map((week, weekIndex) => (
              <div className="lapidary-date-picker__week" role="row" key={weekIndex}>
                {week.map((date, dayIndex) => {
                  if (!date) return <span role="gridcell" aria-disabled="true" key={`empty-${weekIndex}-${dayIndex}`} />;
                  const key = dateKey(date);
                  const isSelected = key === value;
                  const isToday = key === minDate;
                  return (
                    <span role="gridcell" aria-selected={isSelected} key={key}>
                      <button
                        ref={(node) => { if (node) dayRefs.current.set(key, node); else dayRefs.current.delete(key); }}
                        type="button"
                        className="lapidary-date-picker__day"
                        data-date={key}
                        aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date)}
                        aria-current={isToday ? "date" : undefined}
                        aria-pressed={isSelected}
                        tabIndex={key === focusedDate ? 0 : -1}
                        disabled={date < minimum}
                        onClick={() => selectDate(date)}
                        onKeyDown={(event) => handleDayKeyDown(event, date)}
                      >
                        {date.getDate()}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="lapidary-date-picker__footer">
            <button type="button" className="lapidary-date-picker__clear" onClick={() => { onChange(""); setOpen(false); triggerRef.current?.focus(); }}>{labels.clear}</button>
            <button type="button" className="lapidary-date-picker__today" onClick={() => selectDate(minimum)}>{labels.today}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
