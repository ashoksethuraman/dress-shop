import React from 'react';

interface LoaderProps {
  /** Show as a full-page fixed overlay — use when a whole-page async operation is in flight */
  fullPage?: boolean;
  /** Spinner size */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label rendered below the spinner */
  label?: string;
}

const SIZE_CLS: Record<string, string> = {
  sm: 'w-5 h-5',
  md: 'w-9 h-9',
  lg: 'w-14 h-14',
};

/**
 * Common Loader / Spinner component.
 *
 * Usage:
 *   {loading && <Loader />}                         // inline spinner
 *   {loading && <Loader fullPage label="Saving…" />} // full-page overlay
 */
export default function Loader({ fullPage = false, size = 'md', label }: LoaderProps) {
  const spinner = (
    <div className="flex flex-col items-center gap-2.5">
      <svg
        className={`animate-spin ${SIZE_CLS[size]} text-indigo-500`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label && <span className="text-sm text-gray-500 font-medium">{label}</span>}
    </div>
  );

  if (fullPage) {
    return (
      <div
        className="fixed inset-0 bg-white/70 backdrop-blur-sm z-[300] flex items-center justify-center"
        role="status"
        aria-label={label ?? 'Loading'}
      >
        {spinner}
      </div>
    );
  }

  return (
    <div role="status" aria-label={label ?? 'Loading'}>
      {spinner}
    </div>
  );
}
