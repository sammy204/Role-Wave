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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please reload RoleWave.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);
