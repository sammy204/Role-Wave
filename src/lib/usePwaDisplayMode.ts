import { useEffect, useState } from 'react';

/**
 * Detects whether the app is currently running as an installed PWA
 * (added to home screen / launched standalone) rather than in a
 * regular browser tab.
 *
 * Note: on Android/Chrome, `display-mode: standalone` only fires for
 * apps installed via a proper web app manifest with `display: standalone`.
 * This repo does not yet ship a manifest.json, so this will currently
 * only ever return true on iOS Safari's "Add to Home Screen".
 */
export function useIsPwa(): boolean {
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const update = () => {
      const standalone = mediaQuery.matches;
      const iosStandalone =
        typeof window !== 'undefined' &&
        'standalone' in window.navigator &&
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsPwa(standalone || iosStandalone);
    };

    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  return isPwa;
}
