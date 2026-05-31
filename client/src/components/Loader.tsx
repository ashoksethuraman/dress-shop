import React, { useState, useEffect } from 'react';

interface LoaderProps {
  /** Show as a full-page fixed overlay */
  fullPage?: boolean;
  /** Spinner size */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label rendered below the spinner */
  label?: string;
}

const SIZE_PX: Record<string, number> = { sm: 80, md: 130, lg: 180 };

export default function Loader({ fullPage = false, size = 'md', label }: LoaderProps) {
  const px = SIZE_PX[size];
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation after mount - reduced delay for faster appearance
    const timer = setTimeout(() => setFadeIn(true), 5);
    return () => clearTimeout(timer);
  }, []);

  const content = (
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      <img
        src="/assets/app-loader-4.svg"
        alt="Loading"
        width={px}
        height={px}
        style={{ display: 'block' }}
      />
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
        style={{
          opacity: fadeIn ? 1 : 0,
          transition: 'opacity 0.1s ease-in-out'
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}

