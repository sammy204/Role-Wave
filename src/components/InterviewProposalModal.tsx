import { useState } from 'react';
import { CalendarDays, Link2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { JobApplication } from '../types';

interface InterviewProposalModalProps {
  application: JobApplication;
  onClose: () => void;
  onCreated: () => void;
}

export default function InterviewProposalModal({ application, onClose, onCreated }: InterviewProposalModalProps) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [meetingLink, setMeetingLink] = useState('');
  const [slotValues, setSlotValues] = useState(['']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateSlot = (index: number, value: string) => {
    setSlotValues((current) => current.map((slot, slotIndex) => (slotIndex === index ? value : slot)));
  };

  const addSlot = () => setSlotValues((current) => (current.length < 5 ? [...current, ''] : current));

  const submit = async () => {
    setSaving(true);
    setError('');
    const starts = slotValues.filter(Boolean).map((value) => new Date(value));
    if (starts.length < 1 || starts.some((value) => Number.isNaN(value.getTime()) || value <= new Date())) {
      setError('Provide 1 to 5 future days and times.');
      setSaving(false);
      return;
    }
    if (new Set(starts.map((value) => value.toISOString())).size !== starts.length) {
      setError('Each proposed day and time must be different.');
      setSaving(false);
      return;
    }
    const { error: invokeError } = await supabase.functions.invoke('create-interview-slots', {
      body: {
        application_id: application.id,
        meeting_link: meetingLink.trim(),
        timezone,
        slots: starts.map((value) => ({ starts_at: value.toISOString(), duration_minutes: 45 })),
      },
    });
    if (invokeError) {
      let message = invokeError.message || 'Could not propose interview days and times.';
      const response = (invokeError as { context?: unknown }).context;
      if (response instanceof Response) {
        const responseBody = await response.json().catch(() => null) as { error?: unknown } | null;
        if (typeof responseBody?.error === 'string' && responseBody.error.trim()) {
          message = responseBody.error;
        }
      }
      setError(message);
    } else onCreated();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-[24px] border border-line bg-paper p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarDays size={16} /> Propose interview days and times</div>
            <p className="mt-1 text-xs text-muted">{application.applicant_name} will choose one from their dashboard.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted hover:bg-[#EDEBE2]" aria-label="Close"><X size={18} /></button>
        </div>
        <label className="mt-5 block text-xs font-semibold text-ink">Meeting link
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-white px-3"><Link2 size={14} className="text-muted" /><input value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://meet.example.com/..." className="w-full bg-transparent py-2.5 text-sm outline-none" /></div>
        </label>
        <div className="mt-4 text-xs font-semibold text-ink">Proposed days and times <span className="font-normal text-muted">({timezone})</span></div>
        <div className="mt-2 space-y-2">
          {slotValues.map((value, index) => <input key={index} type="datetime-local" value={value} onChange={(event) => updateSlot(index, event.target.value)} className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent" />)}
        </div>
        {slotValues.length < 5 && <button type="button" onClick={addSlot} className="mt-2 text-xs font-semibold text-accent-text hover:underline">+ Add another day and time</button>}
        {error && <div className="mt-3 rounded-lg border border-pill-red-border bg-pill-red-bg px-3 py-2 text-sm text-pill-red-text">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-muted">Cancel</button>
          <button type="button" onClick={submit} disabled={saving || !meetingLink.trim()} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Sending...' : 'Send choices'}</button>
        </div>
      </div>
    </div>
  );
}