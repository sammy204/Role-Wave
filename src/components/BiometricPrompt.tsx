import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { useIsPwa } from '../lib/usePwaDisplayMode';
import { listPasskeys, passkeyEnabledOnDevice, passkeysSupported, registerPasskey, setPasskeyDeviceStatus } from '../lib/passkeys';
import { trackEvent } from '../lib/analytics';
import { getUserFacingError } from '../lib/userFacingError';

export default function BiometricPrompt() {
  const { session, loading: authLoading } = useAuth();
  const isPwa = useIsPwa();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !session || !isPwa || !passkeysSupported() || passkeyEnabledOnDevice()) return;

    let active = true;
    void listPasskeys().then(({ data, error: listError }) => {
      if (!active || listError) return;
      if (data?.length) {
        setPasskeyDeviceStatus('enabled');
        return;
      }
      setVisible(true);
    });

    return () => {
      active = false;
    };
  }, [authLoading, isPwa, session]);

  if (!visible) return null;

  const enablePasskey = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: registerError } = await registerPasskey();
      if (registerError) throw registerError;
      setPasskeyDeviceStatus('enabled');
      void trackEvent('passkey_enabled', {});
      setVisible(false);
    } catch (registerError) {
      setError(getUserFacingError(registerError, 'We couldn’t set up passkey sign-in. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    setPasskeyDeviceStatus('dismissed');
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="biometric-prompt-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E1F5EE] text-[#0F6E56]"><Fingerprint size={24} /></div>
        <h2 id="biometric-prompt-title" className="mt-4 text-lg font-bold text-[#1A1A1A]">Enable biometric sign-in?</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">Use your fingerprint, face unlock, or device screen lock to sign in faster next time.</p>
        {error && <p className="mt-3 text-sm text-[#B3261E]">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={dismiss} disabled={loading} className="rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#5F5E5A] hover:bg-[#F1EFE8] disabled:opacity-50">Not now</button>
          <button type="button" onClick={() => void enablePasskey()} disabled={loading} className="rounded-xl bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#168a63] disabled:opacity-50">{loading ? 'Setting up…' : 'Enable'}</button>
        </div>
      </div>
    </div>
  );
}
