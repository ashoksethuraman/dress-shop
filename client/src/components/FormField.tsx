import React from 'react';

interface FormFieldProps {
  label: string;
  id: string;
  error?: string;
  placeholder?: string;
  type?: string;
  optional?: boolean;
  registration: object;
}

export default function FormField({
  label, id, error, placeholder, type = 'text', optional = false, registration,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-gray-500">
        {label}{optional && <span className="text-gray-400 ml-1">(optional)</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder ?? label}
        {...(registration as any)}
        className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all
          ${error ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:border-brand-dark focus:ring-brand'}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
