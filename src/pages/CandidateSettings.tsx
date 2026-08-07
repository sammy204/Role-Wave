import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Database, LockKeyhole, LogOut, Mail, Save, ShieldCheck, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import { getCurrentPushSubscription, enablePushNotifications, disablePushNotifications, pushNotificationsConfigured, pushNotificationSupportMessage } from '../lib/pushNotifications';
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
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = window.localStorage.getItem('rolewave-theme');
    return storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'light';
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [applicationEmails, setApplicationEmails] = useState(true);
  const [recommendationEmails, setRecommendationEmails] = useState(true);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

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
      supabase.from('profiles').select('email_application_updates, email_job_recommendations').eq('id', session.user.id).maybeSingle(),
    ]).then(([profileResult, subscription, settingsResult]) => {
      if (!alive) return;
      const value = profileResult.data?.visibility_to_employers;
      if (value === 'open' || value === 'not_open' || value === 'hidden') setVisibility(value);
      setPushEnabled(Boolean(subscription));
      if (typeof settingsResult.data?.email_application_updates === 'boolean') setApplicationEmails(settingsResult.data.email_application_updates);
      if (typeof settingsResult.data?.email_job_recommendations === 'boolean') setRecommendationEmails(settingsResult.data.email_job_recommendations);
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

  const deleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: deleteConfirmText },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      const scheduledFor = data?.deletion_scheduled_for;
      if (scheduledFor) sessionStorage.setItem('rolewave-account-deletion-scheduled', scheduledFor);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      navigate(scheduledFor ? `/account-deletion-scheduled?date=${encodeURIComponent(scheduledFor)}` : '/', { replace: true });
    } catch (deleteAccountError) {
      setDeleteError(deleteAccountError instanceof Error ? deleteAccountError.message : 'Could not delete account.');
      setDeleting(false);
    }
  };

  const toggleReducedMotion = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    window.localStorage.setItem('rolewave-reduced-motion', next ? '1' : '0');
    document.documentElement.dataset.reduceMotion = next ? 'true' : 'false';
  };

  const changeTheme = (next: Theme) => {
    setTheme(next);
    setMessage('');
    setError('');
  };

  const toggleEmailPreference = async (key: 'applications' | 'recommendations', enabled: boolean) => {
    if (!session) return;
    const previous = key === 'applications' ? applicationEmails : recommendationEmails;
    if (key === 'applications') setApplicationEmails(enabled);
    else setRecommendationEmails(enabled);
    setError('');
    const { error: preferenceError } = await supabase
      .from('profiles')
      .update({ [key === 'applications' ? 'email_application_updates' : 'email_job_recommendations']: enabled })
      .eq('id', session.user.id);
    if (preferenceError) {
      if (key === 'applications') setApplicationEmails(previous);
      else setRecommendationEmails(previous);
      setError(preferenceError.message);
      return;
    }
    setMessage('Email preference saved.');
  };

  if (authLoading || loading) {
    return <div className="page-shell items-center justify-center px-4"><LoadingSpinner className="text-[#1D9E75]" /></div>;
  }

  return (
    <div className="page-shell px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#8A867E]">Candidate workspace</div>
          <h1 className="mt-1 text-3xl font-bold text-[#1A1A1A]">Settings</h1>
          <p className="mt-2 text-sm text-[#5F5E5A]">Control how employers discover you and how RoleWave keeps you updated.</p>
        </div>

        {message && <div className="rounded-2xl border border-[#5DCAA5] bg-[#E1F5EE] px-4 py-3 text-sm text-[#085041]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">{error}</div>}

        <details className="panel order-2 rounded-[28px] p-5 sm:p-6">
          <summary className="flex cursor-pointer items-start gap-3">
            <ShieldCheck className="mt-0.5 text-[#1D9E75]" size={20} />
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Visibility</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Choose whether employers can view your candidate profile.</p>
            </div>
          </summary>
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)} className="mt-5 w-full rounded-xl border border-[#D3D1C7] bg-white px-3 py-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1D9E75]">
            <option value="open">Visible to employers</option>
            <option value="not_open">Not open to work, but visible</option>
            <option value="hidden">Hidden from employers</option>
          </select>
          <button type="button" onClick={saveVisibility} disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <Save size={15} /> {saving ? 'Saving...' : 'Save privacy settings'}
          </button>
        </details>

        <details className="panel order-3 rounded-[28px] p-5 sm:p-6">
          <summary className="flex cursor-pointer items-start gap-3">
            <Mail className="mt-0.5 text-[#1D9E75]" size={20} />
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Email preferences</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Choose which useful updates RoleWave can send to your email.</p>
            </div>
          </summary>
          <div className="mt-5 space-y-3">
            <PreferenceToggle
              title="Application updates"
              description="Status changes, employer messages, and important application activity."
              enabled={applicationEmails}
              onChange={(enabled) => toggleEmailPreference('applications', enabled)}
            />
            <PreferenceToggle
              title="Job recommendations"
              description="Occasional roles that may match your profile and preferences."
              enabled={recommendationEmails}
              onChange={(enabled) => toggleEmailPreference('recommendations', enabled)}
            />
          </div>
        </details>

        <details className="panel order-6 rounded-[28px] p-5 sm:p-6">
          <summary className="flex cursor-pointer items-start gap-3">
            <Database className="mt-0.5 text-[#1D9E75]" size={20} />
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Privacy & data</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Review how RoleWave handles your information and profile visibility.</p>
            </div>
          </summary>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link to="/privacy" className="rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3 text-sm font-semibold text-[#0F6E56] hover:border-[#5DCAA5]">
              Read Privacy Policy
            </Link>
            <Link to="/terms" className="rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3 text-sm font-semibold text-[#0F6E56] hover:border-[#5DCAA5]">
              Read Terms of Service
            </Link>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#8A867E]">You can request account deletion from the danger zone below. Data export requests can be sent through Contact Us.</p>
        </details>

        <details className="panel order-4 rounded-[28px] p-5 sm:p-6">
          <summary className="flex cursor-pointer items-start gap-3">
            <span className="mt-0.5 text-xl leading-none text-[#1D9E75]" aria-hidden="true">◐</span>
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Appearance and preferences</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Personalize how RoleWave feels and behaves on this device.</p>
            </div>
          </summary>
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
        </details>

        <details className="panel order-1 rounded-[28px] p-5 sm:p-6">
          <summary className="flex cursor-pointer items-start gap-3">
            <Bell className="mt-0.5 text-[#1D9E75]" size={20} />
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Notifications</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Receive alerts for messages and application updates.</p>
            </div>
          </summary>
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[#1A1A1A]">Push notifications</div>
              <div className="mt-1 text-xs text-[#8A867E]">{pushEnabled ? 'Enabled on this device' : 'Disabled on this device'}</div>
            </div>
            <button type="button" onClick={togglePush} disabled={pushSaving || !pushNotificationsConfigured()} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pushEnabled ? 'bg-[#1D9E75] text-white' : 'border border-[#D3D1C7] bg-white text-[#5F5E5A]'} disabled:cursor-not-allowed disabled:opacity-50`}>
              {pushSaving ? 'Updating...' : pushEnabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
          {!pushNotificationsConfigured() && <p className="mt-2 text-xs text-[#8A867E]">{pushNotificationSupportMessage()}</p>}
        </details>

        <details className="panel order-5 rounded-[28px] p-5 sm:p-6">
          <summary className="flex cursor-pointer items-start gap-3">
            <LockKeyhole className="mt-0.5 text-[#1D9E75]" size={20} />
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Account security</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Signed in as {session?.user.email || 'your account'}.</p>
            </div>
          </summary>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={sendPasswordReset} className="rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1A1A]">Send password reset email</button>
            <span className="inline-flex items-center rounded-xl bg-[#E1F5EE] px-3 py-2.5 text-xs font-semibold text-[#085041]">Email sign-in protected</span>
          </div>
        </details>

        <details className="order-7 rounded-[28px] border border-[#F0D080] bg-[#FFF8E6] p-5 sm:p-6">
          <summary className="cursor-pointer">
            <h2 className="font-semibold text-[#7A5000]">Session</h2>
            <p className="mt-1 text-sm text-[#7A5000]">Sign out of this device.</p>
          </summary>
          <button type="button" onClick={signOut} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#A15A00] px-4 py-2.5 text-sm font-semibold text-white">
            <LogOut size={15} /> Sign out
          </button>
        </details>

        <details className="order-8 rounded-[28px] border border-[#E8B4AD] bg-[#FFF7F5] p-5 sm:p-6">
          <summary className="flex cursor-pointer items-start gap-3">
            <AlertTriangle className="mt-0.5 text-[#B3261E]" size={20} />
            <div>
              <h2 className="font-semibold text-[#7A1B14]">Danger zone</h2>
              <p className="mt-1 text-sm text-[#8C3A32]">Your account will be hidden now and permanently deleted after a 10-day grace period.</p>
            </div>
          </summary>
          <button
            type="button"
            onClick={() => {
              setDeleteError('');
              setDeleteConfirmText('');
              setShowDeleteModal(true);
            }}
            className="mt-5 rounded-xl border border-[#B3261E] bg-[#B3261E] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Delete account
          </button>
        </details>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-[#B3261E]" size={20} />
                <div>
                  <h2 className="font-semibold text-[#1A1A1A]">Delete your account</h2>
                  <p className="mt-1 text-sm text-[#5F5E5A]">
                    Your account will be hidden immediately and permanently deleted after 10 days. Log in before then if you change your mind.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !deleting && setShowDeleteModal(false)}
                className="rounded-full p-1 text-[#8A867E] hover:bg-[#F3F2EE]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[1.2px] text-[#8A867E]">
              Type DELETE to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="DELETE"
              disabled={deleting}
              className="mt-2 w-full rounded-xl border border-[#D3D1C7] bg-white px-3 py-3 text-sm text-[#1A1A1A] outline-none focus:border-[#B3261E]"
            />

            {deleteError && <p className="mt-3 text-sm text-[#B3261E]">{deleteError}</p>}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                className="rounded-xl bg-[#B3261E] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? 'Scheduling...' : 'Schedule account deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreferenceToggle({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-[#1A1A1A]">{title}</div>
        <div className="mt-1 text-xs leading-5 text-[#8A867E]">{description}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        aria-pressed={enabled}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${enabled ? 'bg-[#1D9E75] text-white' : 'border border-[#D3D1C7] bg-white text-[#5F5E5A]'}`}
      >
        {enabled ? 'On' : 'Off'}
      </button>
    </div>
  );
}
