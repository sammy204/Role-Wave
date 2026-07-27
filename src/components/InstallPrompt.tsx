import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useIsPwa } from '../lib/usePwaDisplayMode';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPrompt() {
  const isPwa = useIsPwa();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (isPwa || dismissed || !installEvent) return null;

  const handleInstall = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstallEvent(null);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#D3D1C7] bg-white p-3 shadow-[0_18px_42px_rgba(26,26,26,0.16)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
        <Download size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[#1A1A1A]">Install RoleWave</div>
        <div className="text-xs text-[#5F5E5A]">Keep your job search one tap away.</div>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="shrink-0 rounded-full bg-[#1D9E75] px-3 py-2 text-xs font-semibold text-white hover:bg-[#168a63]"
      >
        Install
      </button>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-full p-1 text-[#5F5E5A] hover:bg-[#F1EFE8]"
      >
        <X size={16} />
      </button>
    </div>
  );
}
