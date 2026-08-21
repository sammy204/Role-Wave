import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, LockKeyhole, Mail, RotateCcw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import { getUserFacingError } from '../lib/userFacingError';
import { resetTutorial } from '../lib/tutorial';
import { openCookieSettings } from '../components/CookieConsent';

type EmailKey = 'email_application_updates' | 'email_new_messages' | 'email_marketing_communications';

function PreferenceToggle({ title, description, enabled, onChange }: { title: string; description: string; enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3">
      <div><div className="text-sm font-semibold text-[#1A1A1A]">{title}</div><div className="mt-1 text-xs text-[#8A867E]">{description}</div></div>
      <button type="button" onClick={() => onChange(!enabled)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${enabled ? 'bg-[#1D9E75] text-white' : 'border border-[#D3D1C7] bg-white text-[#5F5E5A]'}`} aria-pressed={enabled}>{enabled ? 'On' : 'Off'}</button>
    </div>
  );
}

export default function EmployerSettings() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<EmailKey | 'pause' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [emails, setEmails] = useState({ application: true, messages: true, marketing: false, paused: false });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const replayTutorial = () => {
    if (!session) return;
    resetTutorial(session.user.id, 'employer');
    navigate('/employer/dashboard');
  };

  useEffect(() => {
    if (authLoading) return;
    if (!session) { navigate('/start?role=employer', { replace: true }); return; }
    let alive = true;
    void Promise.all([
      supabase.from('profiles').select('account_type, email_application_updates, email_new_messages, email_marketing_communications, email_pause_optional').eq('id', session.user.id).maybeSingle(),
    ]).then(([result]) => {
      if (!alive) return;
      if (result.data?.account_type === 'candidate') { navigate('/candidate', { replace: true }); return; }
      setEmails({
        application: result.data?.email_application_updates !== false,
        messages: result.data?.email_new_messages !== false,
        marketing: result.data?.email_marketing_communications === true,
        paused: result.data?.email_pause_optional === true,
      });
      if (result.error) setError(getUserFacingError(result.error, 'We couldn’t load your settings. Please try again.'));
    }).catch((loadError) => { if (alive) setError(getUserFacingError(loadError, 'We couldn’t load your settings. Please try again.')); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, navigate, session]);

  const updateEmail = async (key: EmailKey, value: boolean) => {
    if (!session) return;
    const stateKey = key === 'email_application_updates' ? 'application' : key === 'email_new_messages' ? 'messages' : 'marketing';
    setEmails((current) => ({ ...current, [stateKey]: value, ...(emails.paused && value ? { paused: false } : {}) }));
    setSaving(key); setError(''); setMessage('');
    const { error: saveError } = await supabase.from('profiles').update({ [key]: value, ...(emails.paused && value ? { email_pause_optional: false } : {}) }).eq('id', session.user.id);
    if (saveError) { setError(getUserFacingError(saveError, 'We couldn’t save your email preferences. Please try again.')); setEmails((current) => ({ ...current, [stateKey]: !value })); } else setMessage('Email preference saved.');
    setSaving(null);
  };

  const togglePause = async (paused: boolean) => {
    if (!session) return;
    setSaving('pause'); setError(''); setMessage('');
    const update = paused ? { email_pause_optional: true, email_application_updates: false, email_new_messages: false, email_marketing_communications: false } : { email_pause_optional: false };
    const { error: saveError } = await supabase.from('profiles').update(update).eq('id', session.user.id);
    if (saveError) setError(getUserFacingError(saveError, 'We couldn’t save your settings. Please try again.'));
    else { setEmails((current) => ({ ...current, paused, ...(paused ? { application: false, messages: false, marketing: false } : {}) })); setMessage(paused ? 'Optional emails paused.' : 'Optional emails restored.'); }
    setSaving(null);
  };

  const resetPassword = async () => {
    if (!session?.user.email) return;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(session.user.email, { redirectTo: `${window.location.origin}/start?mode=login` });
    if (resetError) setError(getUserFacingError(resetError, 'We couldn’t send the reset email. Please try again.')); else setMessage('Password reset instructions sent.');
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true); setDeleteError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('delete-account', { body: { confirmation: deleteConfirm } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      const scheduledFor = data?.deletion_scheduled_for;
      if (scheduledFor) sessionStorage.setItem('rolewave-account-deletion-scheduled', scheduledFor);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      navigate(scheduledFor ? `/account-deletion-scheduled?date=${encodeURIComponent(scheduledFor)}` : '/', { replace: true });
    } catch (deleteErrorValue) { setDeleteError(getUserFacingError(deleteErrorValue, 'We couldn’t delete your account. Please try again.')); setDeleting(false); }
  };

  if (authLoading || loading) return <div className="page-shell items-center justify-center px-4"><LoadingSpinner className="text-[#1D9E75]" /></div>;

  return (
    <div className="page-shell px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div><div className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#8A867E]">Employer workspace</div><h1 className="mt-1 text-3xl font-bold text-[#1A1A1A]">Settings</h1><p className="mt-2 text-sm text-[#5F5E5A]">Manage account preferences and how RoleWave keeps you updated.</p></div>
      {message && <div className="rounded-2xl border border-[#5DCAA5] bg-[#E1F5EE] px-4 py-3 text-sm text-[#085041]">{message}</div>}
      {error && <div className="rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">{error}</div>}
      <details className="panel rounded-[28px] p-5 sm:p-6"><summary className="flex cursor-pointer items-start gap-3"><RotateCcw className="mt-0.5 text-[#1D9E75]" size={20} /><div><h2 className="font-semibold text-[#1A1A1A]">Workspace guidance</h2><p className="mt-1 text-sm text-[#5F5E5A]">Take the short tour again to revisit the main RoleWave features.</p></div></summary><button type="button" onClick={replayTutorial} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#1D9E75] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F6E56] hover:bg-[#E1F5EE]"><RotateCcw size={15} /> Replay RoleWave tour</button></details>
      <details open className="panel rounded-[28px] p-5 sm:p-6"><summary className="flex cursor-pointer items-start gap-3"><Bell className="mt-0.5 text-[#1D9E75]" size={20} /><div><h2 className="font-semibold text-[#1A1A1A]">Notifications</h2><p className="mt-1 text-sm text-[#5F5E5A]">Choose which updates your employer account receives.</p></div></summary><div className="mt-5 space-y-3"><PreferenceToggle title="Application updates" description="Important changes to candidate applications and offers." enabled={emails.application} onChange={(value) => updateEmail('email_application_updates', value)} /><PreferenceToggle title="Message notifications" description="When a candidate sends a new message." enabled={emails.messages} onChange={(value) => updateEmail('email_new_messages', value)} /><PreferenceToggle title="News and announcements" description="Occasional RoleWave product and service updates." enabled={emails.marketing} onChange={(value) => updateEmail('email_marketing_communications', value)} /><PreferenceToggle title="Pause all optional emails" description="Security and account emails will still arrive." enabled={emails.paused} onChange={togglePause} />{saving && <p className="text-xs text-[#8A867E]">Saving...</p>}</div></details>
      <details className="panel rounded-[28px] p-5 sm:p-6"><summary className="flex cursor-pointer items-start gap-3"><LockKeyhole className="mt-0.5 text-[#1D9E75]" size={20} /><div><h2 className="font-semibold text-[#1A1A1A]">Security</h2><p className="mt-1 text-sm text-[#5F5E5A]">Manage access to your employer account.</p></div></summary><button type="button" onClick={resetPassword} className="mt-5 rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1A1A]">Send password reset email</button></details>
      <details className="panel rounded-[28px] p-5 sm:p-6"><summary className="flex cursor-pointer items-start gap-3"><Mail className="mt-0.5 text-[#1D9E75]" size={20} /><div><h2 className="font-semibold text-[#1A1A1A]">Privacy and data</h2><p className="mt-1 text-sm text-[#5F5E5A]">Review RoleWave’s policies and account data options.</p></div></summary><div className="mt-5 flex flex-wrap gap-2"><a href="/privacy" className="rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F6E56]">Privacy Policy</a><a href="/terms" className="rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F6E56]">Terms of Service</a><button type="button" onClick={openCookieSettings} className="rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F6E56]">Manage Cookie Settings</button></div></details>
      <details className="rounded-[28px] border border-[#E8B4AD] bg-[#FFF7F5] p-5 sm:p-6"><summary className="flex cursor-pointer items-start gap-3"><AlertTriangle className="mt-0.5 text-[#B3261E]" size={20} /><div><h2 className="font-semibold text-[#7A1B14]">Danger zone</h2><p className="mt-1 text-sm text-[#8C3A32]">Schedule your account for deletion.</p></div></summary><button type="button" onClick={() => { setDeleteError(''); setDeleteConfirm(''); setShowDeleteModal(true); }} className="mt-5 rounded-xl bg-[#B3261E] px-4 py-2.5 text-sm font-semibold text-white">Delete account</button></details>
    </div>
    {showDeleteModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-[#1A1A1A]">Delete your account</h2><p className="mt-1 text-sm text-[#5F5E5A]">Your account will be hidden immediately and permanently deleted after the grace period.</p></div><button type="button" onClick={() => !deleting && setShowDeleteModal(false)} aria-label="Close" className="rounded-full p-1 text-[#8A867E]"><X size={18} /></button></div><label className="mt-5 block text-xs font-semibold uppercase tracking-[1.2px] text-[#8A867E]">Type DELETE to confirm</label><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D3D1C7] px-3 py-3 text-sm" placeholder="DELETE" disabled={deleting} />{deleteError && <p className="mt-3 text-sm text-[#B3261E]">{deleteError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowDeleteModal(false)} disabled={deleting} className="rounded-xl border border-[#D3D1C7] px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={deleteAccount} disabled={deleting || deleteConfirm !== 'DELETE'} className="rounded-xl bg-[#B3261E] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{deleting ? 'Scheduling...' : 'Schedule deletion'}</button></div></div></div>}
    </div>
  );
}
