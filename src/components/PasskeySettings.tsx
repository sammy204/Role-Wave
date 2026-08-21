import { useEffect, useState } from 'react';
import { Fingerprint, Trash2 } from 'lucide-react';
import { getUserFacingError } from '../lib/userFacingError';
import { listPasskeys, passkeysSupported, registerPasskey } from '../lib/passkeys';
import { supabase } from '../lib/supabase';

export default function PasskeySettings() {
  const [passkeys, setPasskeys] = useState<Array<{ id: string; friendly_name?: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supported = passkeysSupported();

  const loadPasskeys = async () => {
    if (!supported) return;
    const { data, error: listError } = await listPasskeys();
    if (listError) throw listError;
    setPasskeys(data || []);
  };

  useEffect(() => {
    void loadPasskeys().catch(() => undefined);
  }, [supported]);

  const addPasskey = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: registerError } = await registerPasskey();
      if (registerError) throw registerError;
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
    } catch (deleteError) {
      setError(getUserFacingError(deleteError, 'We couldn’t remove this passkey. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (!supported) return <p className="mt-4 text-sm text-[#5F5E5A]">Passkey sign-in is not available in this browser or device.</p>;

  return (
    <div className="mt-5 space-y-3">
      <p className="text-sm text-[#5F5E5A]">Use your device fingerprint, face unlock, or screen lock to sign in without typing your password.</p>
      {passkeys.map((passkey) => (
        <div key={passkey.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2"><Fingerprint size={17} className="shrink-0 text-[#1D9E75]" /><span className="truncate text-sm font-semibold text-[#1A1A1A]">{passkey.friendly_name || 'This device'}</span></div>
          <button type="button" onClick={() => removePasskey(passkey.id)} disabled={loading} className="rounded-lg p-2 text-[#B3261E] hover:bg-[#FAECE7] disabled:opacity-50" aria-label="Remove passkey"><Trash2 size={15} /></button>
        </div>
      ))}
      {error && <p className="text-sm text-[#B3261E]">{error}</p>}
      <button type="button" onClick={addPasskey} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#1D9E75] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F6E56] hover:bg-[#E1F5EE] disabled:opacity-50"><Fingerprint size={16} /> {loading ? 'Setting up…' : passkeys.length ? 'Add another passkey' : 'Set up passkey sign-in'}</button>
    </div>
  );
}
