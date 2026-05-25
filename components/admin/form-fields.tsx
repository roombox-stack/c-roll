// Shared form-field primitives for the admin CRUD pages. Server-component-safe
// (no hooks). Each one is a controlled-by-default-value uncontrolled input —
// state lives in the form, server action reads via FormData.

import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

const INPUT_CLS =
  'w-full rounded border border-ash bg-ink px-3 py-2 text-white focus:border-gray-500 focus:outline-none';

export function Field({
  label,
  name,
  type = 'text',
  ...rest
}: { label: string; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-gray-400">{label}</span>
      <input type={type} name={name} className={INPUT_CLS} {...rest} />
    </label>
  );
}

export function TextareaField({
  label,
  name,
  rows = 4,
  ...rest
}: { label: string; name: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-gray-400">{label}</span>
      <textarea name={name} rows={rows} className={`${INPUT_CLS} font-mono`} {...rest} />
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  placeholder = 'Select…',
  ...rest
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-gray-400">{label}</span>
      <select name={name} className={INPUT_CLS} {...rest}>
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  ...rest
}: { label: string; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        className="h-4 w-4 rounded border-ash bg-ink"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}

export function SubmitButton({ children = 'Save' }: { children?: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-gray-200"
    >
      {children}
    </button>
  );
}
