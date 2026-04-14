import { useEffect, useCallback } from 'react';

const SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY ?? '';
const SCRIPT_ID = 'recaptcha-v3-script';

/**
 * Dynamically injects the reCAPTCHA v3 script when the component mounts
 * (instead of loading it globally in index.html).
 * Returns an `executeRecaptcha(action)` function that resolves with a token.
 * Resolves with '' when no site key is configured (dev / CI).
 */
export function useRecaptcha(): (action: string) => Promise<string> {
  useEffect(() => {
    if (!SITE_KEY || document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    // Script is intentionally kept after unmount so grecaptcha stays available
    // if the user navigates back to SignupPage without a full page reload.
  }, []);

  return useCallback((action: string): Promise<string> => {
    if (!SITE_KEY) return Promise.resolve('');

    return new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(SITE_KEY, { action })
          .then(resolve)
          .catch(reject);
      });
    });
  }, []);
}
