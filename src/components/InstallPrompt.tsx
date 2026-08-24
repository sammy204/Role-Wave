import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useIsPwa } from '../lib/usePwaDisplayMode';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallPlatform = 'android' | 'ios' | 'desktop' | 'unknown';

function getInstallPlatform(): InstallPlatform {
  const navigatorWithPlatform = navigator as Navigator & { userAgentData?: { platform?: string } };
  const userAgent = navigator.userAgent;
  const platform = navigatorWithPlatform.userAgentData?.platform || navigator.platform || '';
  const isIpadOs = platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  if (/iPhone|iPad|iPod/i.test(userAgent) || isIpadOs) return 'ios';
  if (/Android/i.test(userAgent) || /Android/i.test(platform)) return 'android';
  if (/Windows|Macintosh|Linux/i.test(userAgent) || /Win|Mac|Linux/i.test(platform)) return 'desktop';
  return 'unknown';
}

export default function InstallPrompt() {
  const isPwa = useIsPwa();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem('rolewave-install-dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [showInstructions, setShowInstructions] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('unknown');

  useEffect(() => {
    setPlatform(getInstallPlatform());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      setShowInstructions(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const canShowPrompt = installEvent || platform === 'ios' || platform === 'android';
  if (isPwa || dismissed || !canShowPrompt) return null;

  const isIos = platform === 'ios';

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem('rolewave-install-dismissed', 'true');
    } catch {
      // The prompt can still be dismissed for this session when storage is unavailable.
    }
  };

  const handleInstall = async () => {
    if (!installEvent) {
      setShowInstructions(true);
      return;
    }

    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#D3D1C7] bg-white p-3 shadow-[0_18px_42px_rgba(26,26,26,0.16)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]"><Download size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#1A1A1A]">Install RoleWave</div>
          <div className="text-xs text-[#5F5E5A]">{isIos ? 'Add RoleWave to your Home Screen.' : 'Keep your job search one tap away.'}</div>
        </div>
        <button type="button" onClick={handleInstall} className="shrink-0 rounded-full bg-[#1D9E75] px-3 py-2 text-xs font-semibold text-white hover:bg-[#168a63]">Install</button>
        <button type="button" aria-label="Install later" onClick={handleDismiss} className="shrink-0 rounded-full p-1 text-[#5F5E5A] hover:bg-[#F1EFE8]"><X size={16} /></button>
      </div>

      {showInstructions && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" aria-labelledby="install-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="install-title" className="text-lg font-bold text-[#1A1A1A]">Install RoleWave</h2>
                <p className="mt-1 text-sm text-[#5F5E5A]">Use RoleWave like an app from your home screen.</p>
              </div>
              <button type="button" aria-label="Close installation instructions" onClick={() => setShowInstructions(false)} className="rounded-full p-1 text-[#5F5E5A] hover:bg-[#F1EFE8]"><X size={18} /></button>
            </div>

            {isIos ? (
              <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[#3D3D3A]">
                <li>Tap the <strong>Share</strong> button in Safari.</li>
                <li>Choose <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong>, then open RoleWave from your new icon.</li>
              </ol>
            ) : (
              <p className="mt-5 text-sm leading-relaxed text-[#3D3D3A]">Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
            )}

            <button type="button" onClick={() => setShowInstructions(false)} className="pwa-primary-button mt-6">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
