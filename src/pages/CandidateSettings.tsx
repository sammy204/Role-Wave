import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, LockKeyhole, LogOut, Save, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import { getCurrentPushSubscription, enablePushNotifications, disablePushNotifications, pushNotificationsConfigured } from '../lib/pushNotifications';
import LoadingSpinner from '../components/LoadingSpinner';

type Visibility = 'open' | 'not_open' | 'hidden';
type Theme = 'light' | 'dark' | 'system';

export default function CandidateSettings() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [visibility, setVisibility] = useState<Visibility>('open');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => window.localStorage.getItem('rolewave-theme') === 'dark' ? 'dark' : 'light');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const useDarkTheme = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      document.documentElement.dataset.theme = useDarkTheme ? 'dark' : 'light';
    };

    applyTheme();
    window.localStorage.setItem('rolewave-theme', theme);

    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    const storedReducedMotion = window.localStorage.getItem('rolewave-reduced-motion') === '1';
    setReducedMotion(storedReducedMotion);
    document.documentElement.dataset.reduceMotion = storedReducedMotion ? 'true' : 'false';
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      navigate('/start?mode=login', { replace: true });
      return;
    }

    let alive = true;
    void Promise.all([
      supabase.from('candidate_profiles').select('visibility_to_employers').eq('id', session.user.id).maybeSingle(),
      getCurrentPushSubscription(),
    ]).then(([profileResult, subscription]) => {
      if (!alive) return;
      const value = profileResult.data?.visibility_to_employers;
      if (value === 'open' || value === 'not_open' || value === 'hidden') setVisibility(value);
      setPushEnabled(Boolean(subscription));
    }).catch((loadError) => {
      if (alive) setError(loadError instanceof Error ? loadError.message : 'Could not load settings.');
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [authLoading, navigate, session]);

  const saveVisibility = async () => {
    if (!session) return;
    setSaving(true);
    setError('');
    setMessage('');
    const { error: saveError } = await supabase
      .from('candidate_profiles')
      .update({ visibility_to_employers: visibility })
      .eq('id', session.user.id);
    if (saveError) setError(saveError.message);
    else setMessage('Privacy settings saved.');
    setSaving(false);
  };

  const togglePush = async () => {
    setPushSaving(true);
    setError('');
    setMessage('');
    try {
      if (pushEnabled) await disablePushNotifications();
      else await enablePushNotifications();
      setPushEnabled(!pushEnabled);
      setMessage(`Push notifications ${pushEnabled ? 'disabled' : 'enabled'}.`);
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'Could not update push notifications.');
    } finally {
      setPushSaving(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!session) return;
    if (!session.user.email) return;
    setError('');
    setMessage('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(session.user.email, {
      redirectTo: `${window.location.origin}/start?mode=login`,
    });
    if (resetError) setError(resetError.message);
    else setMessage('Password reset instructions sent to your email.');
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    navigate('/', { replace: true });
  };

  const toggleReducedMotion = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    window.localStorage.setItem('rolewave-reduced-motion', next ? '1' : '0');
    document.documentElement.dataset.reduceMotion = next ? 'true' : 'false';
  };

  const changeTheme = (next: Theme) => {
    setTheme(next);
    setMessage(`${next === 'dark' ? 'Dark' : next === 'light' ? 'Light' : 'System'} theme enabled.`);
    setError('');
  };

  if (authLoading || loading) {
    return <div className="page-shell items-center justify-center px-4"><LoadingSpinner className="text-[#1D9E75]" /></div>;
  }

  return (
    <div className="page-shell px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#8A867E]">Candidate workspace</div>
          <h1 className="mt-1 text-3xl font-bold text-[#1A1A1A]">Settings</h1>
          <p className="mt-2 text-sm text-[#5F5E5A]">Control how employers discover you and how RoleWave keeps you updated.</p>
        </div>

        {message && <div className="rounded-2xl border border-[#5DCAA5] bg-[#E1F5EE] px-4 py-3 text-sm text-[#085041]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">{error}</div>}

        <section className="panel rounded-[28px] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-[#1D9E75]" size={20} />
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Privacy and visibility</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Choose whether employers can view your candidate profile.</p>
            </div>
          </div>
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)} className="mt-5 w-full rounded-xl border border-[#D3D1C7] bg-white px-3 py-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1D9E75]">
            <option value="open">Visible to employers</option>
            <option value="not_open">Not open to work, but visible</option>
            <option value="hidden">Hidden from employers</option>
          </select>
          <button type="button" onClick={saveVisibility} disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <Save size={15} /> {saving ? 'Saving...' : 'Save privacy settings'}
          </button>
        </section>

        <section className="panel rounded-[28px] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl leading-none text-[#1D9E75]" aria-hidden="true">◐</span>
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Appearance and preferences</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Personalize how RoleWave feels and behaves on this device.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[#1A1A1A]">Theme</div>
                <div className="mt-1 text-xs text-[#8A867E]">Choose the theme used across RoleWave on this device.</div>
              </div>
              <div className="flex rounded-full border border-[#D3D1C7] bg-white p-1">
                {(['light', 'dark', 'system'] as Theme[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => changeTheme(option)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${theme === option ? 'bg-[#1D9E75] text-white' : 'text-[#5F5E5A]'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[#1A1A1A]">Reduce motion</div>
                <div className="mt-1 text-xs text-[#8A867E]">Limit animations and transitions on this device.</div>
              </div>
              <button type="button" onClick={toggleReducedMotion} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${reducedMotion ? 'bg-[#1D9E75] text-white' : 'border border-[#D3D1C7] bg-white text-[#5F5E5A]'}`}>
                {reducedMotion ? 'On' : 'Off'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[#1A1A1A]">Language</div>
                <div className="mt-1 text-xs text-[#8A867E]">English (Nigeria)</div>
              </div>
              <span className="rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#8A867E]">Only language available</span>
            </div>
          </div>
        </section>

        <section className="panel rounded-[28px] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 text-[#1D9E75]" size={20} />
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Notifications</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Receive alerts for messages and application updates.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[#1A1A1A]">Push notifications</div>
              <div className="mt-1 text-xs text-[#8A867E]">{pushEnabled ? 'Enabled on this device' : 'Disabled on this device'}</div>
            </div>
            <button type="button" onClick={togglePush} disabled={pushSaving || !pushNotificationsConfigured()} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pushEnabled ? 'bg-[#1D9E75] text-white' : 'border border-[#D3D1C7] bg-white text-[#5F5E5A]'} disabled:cursor-not-allowed disabled:opacity-50`}>
              {pushSaving ? 'Updating...' : pushEnabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
          {!pushNotificationsConfigured() && <p className="mt-2 text-xs text-[#8A867E]">Push notifications are not available in this browser or environment.</p>}
        </section>

        <section className="panel rounded-[28px] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 text-[#1D9E75]" size={20} />
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Account security</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Signed in as {session?.user.email || 'your account'}.</p>
            </div>
          </div>
          <button type="button" onClick={sendPasswordReset} className="mt-5 rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1A1A]">Send password reset email</button>
        </section>

        <section className="rounded-[28px] border border-[#F0D080] bg-[#FFF8E6] p-5 sm:p-6">
          <h2 className="font-semibold text-[#7A5000]">Session</h2>
          <p className="mt-1 text-sm text-[#7A5000]">Sign out of this device.</p>
          <button type="button" onClick={signOut} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#A15A00] px-4 py-2.5 text-sm font-semibold text-white">
            <LogOut size={15} /> Sign out
          </button>
        </section>

        <section className="rounded-[28px] border border-[#E8B4AD] bg-[#FFF7F5] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-[#B3261E]" size={20} />
            <div>
              <h2 className="font-semibold text-[#7A1B14]">Danger zone</h2>
              <p className="mt-1 text-sm text-[#8C3A32]">Account deletion will permanently remove your profile, applications, messages, and uploaded files.</p>
            </div>
          </div>
          <button type="button" disabled className="mt-5 rounded-xl border border-[#E8B4AD] bg-white px-4 py-2.5 text-sm font-semibold text-[#B3261E] opacity-60">
            Delete account · Coming soon
          </button>
        </section>
      </div>
    </div>
  );
}
