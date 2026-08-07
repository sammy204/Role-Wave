import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
    <App />
  </StrictMode>
);
