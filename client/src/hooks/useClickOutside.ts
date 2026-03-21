import { useEffect, RefObject } from 'react';

/**
 * Fires `handler` when a mousedown event occurs outside the referenced element.
 * Setting `enabled = false` skips attaching the listener entirely (useful when
 * the element is not rendered or the feature is conditionally active).
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler, enabled]);
}
