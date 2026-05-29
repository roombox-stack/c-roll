'use client';

// Admin date picker: a labeled field that opens a mini month-grid calendar
// popover on click. Writes the selected date as YYYY-MM-DD into a hidden input
// (name) so existing server actions that read FormData keep working unchanged.

import { useEffect, useRef, useState } from 'react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Parse a YYYY-MM-DD string into a local Date (avoids UTC off-by-one).
function parseISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplay(s: string): string {
  const d = parseISO(s);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DateField({
  label,
  name,
  defaultValue = '',
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  // Which month the calendar is currently showing.
  const initial = parseISO(defaultValue) ?? new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = parseISO(value);
  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }
  function pick(day: number) {
    setValue(toISO(viewYear, viewMonth, day));
    setOpen(false);
  }

  return (
    // NOTE: must NOT be a <label> — a label auto-associates with its first
    // labelable descendant (the button), which double-fires the toggle and
    // makes the popover open-then-immediately-close.
    <div className="block space-y-1">
      <span className="block text-sm text-gray-400">{label}</span>
      {/* Hidden field carries the real value into the form. */}
      <input type="hidden" name={name} value={value} required={required} />

      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded border border-ash bg-ink px-3 py-2 text-left text-white focus:border-gray-500 focus:outline-none"
        >
          <span className={value ? 'text-white' : 'text-gray-500'}>
            {value ? formatDisplay(value) : 'Select a date'}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>

        {open ? (
          <div className="absolute z-50 mt-1 w-72 rounded-lg border border-ash bg-smoke p-3 shadow-xl">
            {/* Header: month nav */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Previous month"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <span className="text-sm font-medium text-white">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Next month"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1 text-[10px] font-medium uppercase text-gray-600">
                  {w}
                </span>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (day === null) return <span key={`e-${i}`} />;
                const iso = toISO(viewYear, viewMonth, day);
                const isSelected = selected && iso === value;
                const isToday = iso === todayISO;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => pick(day)}
                    className={`h-8 rounded text-sm transition ${
                      isSelected
                        ? 'bg-white font-semibold text-ink'
                        : isToday
                          ? 'text-croll hover:bg-white/10'
                          : 'text-gray-200 hover:bg-white/10'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Footer: quick "Today" */}
            <div className="mt-2 flex justify-end border-t border-ash pt-2">
              <button
                type="button"
                onClick={() => {
                  setViewYear(today.getFullYear());
                  setViewMonth(today.getMonth());
                  setValue(todayISO);
                  setOpen(false);
                }}
                className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white"
              >
                Today
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
