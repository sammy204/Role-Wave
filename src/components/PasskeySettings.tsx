import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Trash2 } from 'lucide-react';
import { getUserFacingError } from '../lib/userFacingError';
import { listPasskeys, passkeysSupported, registerPasskey, setPasskeyDeviceStatus } from '../lib/passkeys';
import { supabase } from '../lib/supabase';

export default function PasskeySettings() {
  const [passkeys, setPasskeys] = useState<Array<{ id: string; friendly_name?: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [passkeyToRemove, setPasskeyToRemove] = useState<string | null>(null);
  const supported = passkeysSupported();

  const loadPasskeys = useCallback(async () => {
    if (!supported) return;
    const { data, error: listError } = await listPasskeys();
    if (listError) throw listError;
    setPasskeys(data || []);
  }, [supported]);

  useEffect(() => {
    void loadPasskeys().catch(() => undefined);
  }, [loadPasskeys]);

  const addPasskey = async () => {
    setLoading(true);
    setError('');
    setShowSetupModal(false);
    try {
      const { error: registerError } = await registerPasskey();
      if (registerError) throw registerError;
      setPasskeyDeviceStatus('enabled');
      await loadPasskeys();
    } catch (registerError) {
      setError(getUserFacingError(registerError, 'We couldn’t set up passkey sign-in. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const removePasskey = async (passkeyId: string) => {
    setLoading(true);
    setError('');
    try {
      const { error: deleteError } = await supabase.auth.passkey.delete({ passkeyId });
      if (deleteError) throw deleteError;
      setPasskeys((current) => current.filter((passkey) => passkey.id !== passkeyId));
      if (passkeys.length === 1) setPasskeyDeviceStatus('unset');
    } catch (deleteError) {
      setError(getUserFacingError(deleteError, 'We couldn’t remove this passkey. Please try again.'));
    } finally {
      setLoading(false);
      setPasskeyToRemove(null);
    }
  };

  if (!supported) return <p className="mt-4 text-sm text-[#5F5E5A]">Passkey sign-in is not available in this browser or device.</p>;

  return (
    <div className="mt-5 space-y-3">
      <p className="text-sm text-[#5F5E5A]">Use your device fingerprint, face unlock, or screen lock to sign in without typing your password.</p>
      {passkeys.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#BFE8D7] bg-[#F0FBF6] px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-[#085041]">Passkey sign-in enabled</div>
            <div className="mt-1 text-xs text-[#4D7668]">Available on this device</div>
          </div>
          {passkeys.length === 1 && (
            <button type="button" onClick={() => setPasskeyToRemove(passkeys[0].id)} disabled={loading} className="rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#5F5E5A] hover:bg-[#F1EFE8] disabled:opacity-50">Turn off</button>
          )}
        </div>
      )}
      {passkeys.map((passkey) => (
        <div key={passkey.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2"><Fingerprint size={17} className="shrink-0 text-[#1D9E75]" /><span className="truncate text-sm font-semibold text-[#1A1A1A]">{passkey.friendly_name || 'This device'}</span></div>
          <button type="button" onClick={() => setPasskeyToRemove(passkey.id)} disabled={loading} className="rounded-lg p-2 text-[#B3261E] hover:bg-[#FAECE7] disabled:opacity-50" aria-label="Remove passkey"><Trash2 size={15} /></button>
        </div>
      ))}
      {error && <p className="text-sm text-[#B3261E]">{error}</p>}
      <button type="button" onClick={() => setShowSetupModal(true)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#1D9E75] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F6E56] hover:bg-[#E1F5EE] disabled:opacity-50"><Fingerprint size={16} /> {loading ? 'Setting up…' : passkeys.length ? 'Add another passkey' : 'Set up passkey sign-in'}</button>

      {showSetupModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="passkey-setup-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E1F5EE] text-[#0F6E56]"><Fingerprint size={24} /></div>
            <h3 id="passkey-setup-title" className="mt-4 text-lg font-bold text-[#1A1A1A]">Set up passkey sign-in</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">Use your fingerprint, face unlock, or device screen lock to sign in faster. Your biometric information stays on your device and is never shared with RoleWave.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowSetupModal(false)} className="rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#5F5E5A] hover:bg-[#F1EFE8]">Not now</button>
              <button type="button" onClick={addPasskey} className="rounded-xl bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#168a63]">Continue</button>
            </div>
          </div>
        </div>
      )}

      {passkeyToRemove && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="passkey-remove-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="passkey-remove-title" className="text-lg font-bold text-[#1A1A1A]">Turn off passkey sign-in?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">You can still sign in with your email and password. You can set up passkey sign-in again at any time.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPasskeyToRemove(null)} className="rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#5F5E5A] hover:bg-[#F1EFE8]">Cancel</button>
              <button type="button" onClick={() => void removePasskey(passkeyToRemove)} disabled={loading} className="rounded-xl bg-[#B3261E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#922018] disabled:opacity-50">{loading ? 'Turning off…' : 'Turn off'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
