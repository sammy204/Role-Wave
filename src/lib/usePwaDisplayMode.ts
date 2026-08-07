import { useEffect, useState } from 'react';

/**
 * Detects whether the app is currently running as an installed PWA
 * (added to home screen / launched standalone) rather than in a
 * regular browser tab.
 *
 * On Android/Chrome, `display-mode: standalone` fires for apps installed
 * via the web app manifest with `display: standalone`.
 */
function detectPwaDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;

  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return standalone || iosStandalone;
}

export function useIsPwa(): boolean {
  // Detect synchronously so the first render of an installed app does not
  // briefly render the regular website before the PWA route is chosen.
  const [isPwa, setIsPwa] = useState(detectPwaDisplayMode);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const update = () => {
      setIsPwa(detectPwaDisplayMode());
    };

    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  return isPwa;
}
