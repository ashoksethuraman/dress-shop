import React from 'react';
import './Loader.css';

interface LoaderProps {
  /** Show as a full-page fixed overlay */
  fullPage?: boolean;
  /** Character size */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label rendered below the character */
  label?: string;
}

const BLOB_PX: Record<string, number> = { sm: 72, md: 110, lg: 150 };

/** Bouncy blue blob character — used app-wide for loading states */
function BlobCharacter({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const w = BLOB_PX[size];
  const h = Math.round(w * (158 / 160));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* ── Blob SVG ── */}
      <svg
        className="blob-bounce"
        width={w}
        height={h}
        viewBox="0 0 160 158"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Body */}
        <circle cx="80" cy="76" r="63" fill="#4B82EA" />

        {/* Glossy highlight top-left */}
        <ellipse
          cx="54" cy="50" rx="23" ry="15"
          fill="white" opacity="0.22"
          transform="rotate(-30 54 50)"
        />

        {/* Mouth indent (dark oval for depth) */}
        <ellipse cx="70" cy="101" rx="12" ry="15" fill="#2b4fbf" />

        {/* Smile arc */}
        <path
          d="M60 91 Q72 104 88 91"
          fill="none" stroke="#1e3a8a"
          strokeWidth="2.8" strokeLinecap="round"
        />

        {/* Left eye (white + pupil grouped for blink) */}
        <g className="blob-eye-l">
          <ellipse cx="61" cy="66" rx="12" ry="14" fill="white" />
          <circle  cx="63" cy="68" r="6.5"           fill="#0d0d0d" />
        </g>

        {/* Right eye (white + pupil grouped for blink) */}
        <g className="blob-eye-r">
          <ellipse cx="88" cy="64" rx="10" ry="12" fill="white" />
          <circle  cx="89" cy="66" r="5.5"          fill="#0d0d0d" />
        </g>

        {/* Leg stub at bottom */}
        <rect x="64" y="133" width="26" height="19" rx="11" fill="#3a65d4" />
      </svg>

      {/* Shadow below — scales inversely with bounce height */}
      <div
        className="blob-shadow-pulse"
        style={{
          width:        w * 0.44,
          height:       Math.max(8, w * 0.09),
          background:   '#bcc5d1',
          borderRadius: '50%',
          marginTop:    -2,
        }}
      />
    </div>
  );
}

export default function Loader({ fullPage = false, size = 'md', label }: LoaderProps) {
  const content = (
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      <BlobCharacter size={size} />
      {label && (
        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500, letterSpacing: '0.01em' }}>
          {label}
        </span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div
        className="fixed inset-0 bg-white/75 backdrop-blur-sm z-[300] flex items-center justify-center"
      >
        {content}
      </div>
    );
  }

  return content;
}

