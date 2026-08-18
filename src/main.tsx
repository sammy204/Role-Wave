import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeSentry } from './lib/sentry';
import { initNativePlatform } from './lib/nativeInit';
import { initNativeAuthDeepLink } from './lib/nativeAuthDeepLink';
import { initNativePushNotifications } from './lib/nativePushNotifications';
import * as Sentry from '@sentry/react';

initializeSentry();
void initNativePlatform();
void initNativeAuthDeepLink();
void initNativePushNotifications().catch((error) => {
  console.error('Native push initialization failed:', error);
});

// Keep the installed PWA at a stable scale. `touch-action` handles modern
// browsers; these listeners cover iOS Safari's legacy gesture events too.
const preventBrowserZoom = (event: Event) => event.preventDefault();

document.addEventListener('gesturestart', preventBrowserZoom, { passive: false });
document.addEventListener('gesturechange', preventBrowserZoom, { passive: false });
document.addEventListener('gestureend', preventBrowserZoom, { passive: false });
document.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey) event.preventDefault();
  },
  { passive: false },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please reload RoleWave.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);
