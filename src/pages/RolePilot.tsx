import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Check, Copy, Download, FileText, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import ComingSoonPage from '../components/ComingSoonPage';
import { rolePilotEnabled } from '../lib/featureFlags';

type JobResult = { id: string; title: string; slug: string; company_name: string; location: string; work_type: string; score: number; reasons: string[] };
type Message = { id: string; role: 'user' | 'assistant'; text: string; jobs?: JobResult[]; coverLetter?: string };
type Usage = { is_pro?: boolean; is_test?: boolean; remaining?: number | null; limit?: number | null };
type TailoredCv = { name: string; headline: string; summary: string; skills: string; experience: string; education: string; matchedKeywords: string[] };
const welcome: Message = { id: 'welcome', role: 'assistant', text: 'Hi, I’m Role Pilot. I can help you find roles, understand your fit, write cover letters, improve your resume, and plan your next move.' };

export default function RolePilot() {
  if (!rolePilotEnabled) return <ComingSoonPage title="Role Pilot" description="Your guided job-search companion is being prepared." />;
  return <RolePilotWorkspace />;
}

function RolePilotWorkspace() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const storageKey = userId ? `rolepilot:conversation:${userId}` : '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [coverLetterJob, setCoverLetterJob] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tailoredCv, setTailoredCv] = useState<TailoredCv | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as Message[] | null;
      const restored = saved?.length ? saved.map((message, index) => ({ ...message, id: message.id || `${message.role}-${index}` })) : [welcome];
      setMessages(restored);
    } catch { setMessages([welcome]); }
  }, [storageKey]);

  useEffect(() => {
    if (storageKey && messages.length) localStorage.setItem(storageKey, JSON.stringify(messages.slice(-80)));
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, storageKey]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages); setInput(''); setError(''); setSending(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('role-pilot', { body: { action: 'chat', prompt: text, messages: nextMessages.slice(-12).map((message) => ({ role: message.role, content: message.text })) } });
      if (invokeError) {
        const status = (invokeError as { context?: { status?: number } }).context?.status;
        if (status === 402) throw new Error('You have used your 5 free Role Pilot messages this month. Upgrade to RoleWave Pro for unlimited access.');
        throw invokeError;
      }
      setUsage(data?.usage || null);
      const looksLikeJobRequest = /\b(find|search|show|recommend|look for|job|role|position|vacanc)\b/i.test(text);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: data?.message || 'I’m ready. What would you like help with?', jobs: looksLikeJobRequest && data?.results?.length ? data.results : undefined }]);
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : 'Role Pilot could not respond right now.'); }
    finally { setSending(false); }
  };

  const requestCoverLetter = async (job: JobResult) => {
    if (coverLetterJob || sending) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: `Write me a cover letter for ${job.title} at ${job.company_name}.` }]);
    setCoverLetterJob(job.id); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('role-pilot', { body: { action: 'cover_letter', job_id: job.id } });
      if (invokeError) throw invokeError;
      setUsage(data?.usage || null);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: `Here’s a cover letter for ${job.title}. You can copy it below and paste it into your application.`, coverLetter: data?.cover_letter }]);
    } catch (coverError) { setError(coverError instanceof Error ? coverError.message : 'Role Pilot could not write that cover letter.'); }
    finally { setCoverLetterJob(''); }
  };

  const tailorCv = async () => {
    const description = jobDescription.trim();
    if (!description || tailoring || !userId) return;
    setTailoring(true); setTailorError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('role-pilot', {
        body: { action: 'resume_tweak', job_description: description },
      });
      if (invokeError) {
        const status = (invokeError as { context?: { status?: number } }).context?.status;
        if (status === 402) throw new Error('You have used your 5 free Role Pilot messages this month. Upgrade to RoleWave Pro for unlimited access.');
        throw invokeError;
      }
      setUsage(data?.usage || null);
      if (!data?.tailored_cv) throw new Error('Role Pilot could not create a tailored CV.');
      setTailoredCv(data.tailored_cv as TailoredCv);
    } catch (tailorRequestError) {
      setTailorError(tailorRequestError instanceof Error ? tailorRequestError.message : 'Role Pilot could not tailor your CV right now.');
    } finally { setTailoring(false); }
  };

  return <div className="flex min-h-[calc(100vh-72px)] flex-col bg-[#FBFAF7]">
    <header className="border-b border-line bg-[#FBFAF7]/95 px-5 py-4 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-4xl items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white"><Sparkles size={17} /></div><div><h1 className="text-[15px] font-bold text-ink">Role Pilot</h1><p className="text-[11px] text-muted">Your personal career assistant</p></div></div><div className="text-right text-[11px] text-muted">{usage?.is_pro ? 'RoleWave Pro · unlimited' : usage?.is_test ? 'Unlimited access' : usage ? `${usage.remaining ?? 0} messages left` : '5 free messages each month'}</div></div></header>
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-5 px-4 pb-5 pt-6 sm:px-8 lg:min-h-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:items-start"><section className="order-2 rounded-2xl border border-[#CBEBDD] bg-[#F3FBF7] p-4 lg:order-2 lg:max-h-[calc(100vh-145px)] lg:overflow-y-auto"><div><p className="flex items-center gap-2 text-sm font-bold text-[#085041]"><Sparkles size={16} /> Tailor your CV to a job</p><p className="mt-1 text-xs leading-5 text-[#5F6F67]">Paste a job description and Role Pilot will shape your existing profile around it.</p></div><CvTailorTool jobDescription={jobDescription} setJobDescription={setJobDescription} tailoredCv={tailoredCv} setTailoredCv={setTailoredCv} tailoring={tailoring} error={tailorError} onTailor={() => void tailorCv()} /></section><section className="order-1 flex min-h-0 min-w-0 flex-col lg:order-1 lg:h-[calc(100vh-145px)]"><div className="min-h-0 flex-1 space-y-6 overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-[0_8px_30px_rgba(26,26,26,0.04)] lg:pr-5">{messages.map((message, index) => <MessageBubble key={message.id || `${message.role}-${index}`} message={message} onCoverLetter={requestCoverLetter} coverLetterJob={coverLetterJob} />)}{sending && <div className="flex items-center gap-2 text-[13px] text-muted"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" /></span>Role Pilot is thinking</div>}<div ref={bottomRef} /></div>{error && <div className="mx-auto mb-3 w-full max-w-3xl rounded-xl border border-[#E6C58A] bg-[#FFF8E8] px-4 py-3 text-[12px] text-[#785116]">{error} {error.includes('Upgrade') && <Link to="/candidate/pro" className="font-bold text-accent-deep hover:underline">View RoleWave Pro</Link>}</div>}<div className="mx-auto mt-5 w-full max-w-3xl rounded-2xl border border-line bg-white p-2 shadow-[0_8px_30px_rgba(26,26,26,0.08)] focus-within:border-accent"><div className="flex items-end gap-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Message Role Pilot" rows={1} maxLength={2000} className="max-h-36 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint" /><button type="button" onClick={() => void sendMessage()} disabled={!input.trim() || sending} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={18} /></button></div><div className="px-3 pb-1 text-[10px] text-faint">Role Pilot can make mistakes. Check important application details before submitting. · Shift + Enter for a new line</div></div></section></main>
  </div>;
}

function CvTailorTool({ jobDescription, setJobDescription, tailoredCv, setTailoredCv, tailoring, error, onTailor }: { jobDescription: string; setJobDescription: (value: string) => void; tailoredCv: TailoredCv | null; setTailoredCv: (value: TailoredCv | null) => void; tailoring: boolean; error: string; onTailor: () => void }) {
  if (!tailoredCv) return <div className="mt-4"><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the full job description here..." rows={7} maxLength={12000} className="w-full resize-y rounded-xl border border-[#D6E9DF] bg-white px-3 py-3 text-sm leading-6 text-ink outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/10" /><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="text-[11px] text-[#6B7C74]">Your profile is used as the source. Nothing is added that you have not provided.</span><button type="button" onClick={onTailor} disabled={!jobDescription.trim() || tailoring} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50">{tailoring ? 'Tailoring...' : 'Generate tailored CV'} <Sparkles size={14} /></button></div>{error && <p className="mt-2 text-xs text-[#A15A00]">{error}</p>}</div>;
  return <div className="mt-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-ink">Your tailored CV preview</p><p className="text-[11px] text-muted">Edit any section before saving it as a PDF.</p></div><div className="flex gap-2"><button type="button" onClick={() => setTailoredCv(null)} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-muted hover:text-ink">Start over</button><button type="button" onClick={() => printTailoredCv(tailoredCv)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white hover:bg-accent-deep"><Download size={14} /> Download PDF</button></div></div><div className="mt-3 rounded-xl border border-line bg-white p-4"><input value={tailoredCv.name} onChange={(event) => setTailoredCv({ ...tailoredCv, name: event.target.value })} className="w-full border-b border-line pb-2 text-xl font-bold text-ink outline-none focus:border-accent" /><input value={tailoredCv.headline} onChange={(event) => setTailoredCv({ ...tailoredCv, headline: event.target.value })} className="mt-2 w-full border-b border-line pb-2 text-sm font-semibold text-accent-deep outline-none focus:border-accent" /><label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-muted">Professional summary<textarea value={tailoredCv.summary} onChange={(event) => setTailoredCv({ ...tailoredCv, summary: event.target.value })} rows={4} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-accent" /></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-muted">Key skills<textarea value={tailoredCv.skills} onChange={(event) => setTailoredCv({ ...tailoredCv, skills: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-accent" /></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-muted">Experience<textarea value={tailoredCv.experience} onChange={(event) => setTailoredCv({ ...tailoredCv, experience: event.target.value })} rows={6} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-accent" /></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-muted">Education<textarea value={tailoredCv.education} onChange={(event) => setTailoredCv({ ...tailoredCv, education: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-accent" /></label>{tailoredCv.matchedKeywords.length > 0 && <p className="mt-3 text-[11px] text-muted">Matched job keywords: <span className="font-semibold text-accent-deep">{tailoredCv.matchedKeywords.join(' · ')}</span></p>}</div><p className="mt-2 text-[11px] text-muted">Download PDF opens your device’s print dialog. Choose “Save as PDF.”</p></div>;
}

function MessageBubble({ message, onCoverLetter, coverLetterJob }: { message: Message; onCoverLetter: (job: JobResult) => void; coverLetterJob: string }) {
  if (message.role === 'user') return <div className="flex justify-end"><div className="max-w-[min(85%,620px)] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-[14px] leading-6 text-white">{message.text}</div></div>;
  return <div className="flex items-start gap-3"><div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent-deep"><Sparkles size={14} /></div><div className="min-w-0 max-w-[min(92%,720px)] text-[14px] leading-6 text-ink"><div className="whitespace-pre-wrap">{message.text}</div>{message.jobs && <div className="mt-3 grid gap-3">{message.jobs.map((job) => <div key={job.id} className="rounded-2xl border border-line bg-white p-4 shadow-card"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link to={`/jobs/${job.slug}`} className="font-bold text-ink hover:text-accent-deep">{job.title}</Link><div className="mt-1 text-[12px] text-muted">{job.company_name} · {job.location} · {job.work_type}</div></div><span className="shrink-0 rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-bold text-accent-deep">{job.score}% fit</span></div><div className="mt-2 text-[12px] leading-5 text-muted">{job.reasons.join(' · ')}</div><div className="mt-3 flex gap-2"><Link to={`/jobs/${job.slug}`} className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-accent-deep">View job</Link><button type="button" onClick={() => onCoverLetter(job)} disabled={Boolean(coverLetterJob)} className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">{coverLetterJob === job.id ? 'Writing...' : 'Write cover letter'}</button></div></div>)}</div>}{message.coverLetter && <CoverLetter text={message.coverLetter} />}</div></div>;
}

function CoverLetter({ text }: { text: string }) { const [copied, setCopied] = useState(false); const copy = async () => { await navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }; return <div className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-card"><div className="mb-3 flex items-center justify-between gap-3 text-[12px] font-bold text-muted"><span className="flex items-center gap-2"><FileText size={14} /> Cover letter</span><button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-bold text-accent-deep">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}</button></div><div className="whitespace-pre-wrap text-[13px] leading-6 text-ink">{text}</div></div>; }

function printTailoredCv(cv: TailoredCv) {
  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  if (!printWindow) return;
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character));
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(cv.name)} - CV</title><style>body{font-family:Arial,sans-serif;color:#17231f;max-width:760px;margin:48px auto;line-height:1.55}h1{font-size:30px;margin:0 0 4px}h2{font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#147052;border-bottom:1px solid #d9e5df;padding-bottom:6px;margin-top:28px}p{white-space:pre-wrap;margin:8px 0}.skills{color:#147052;font-weight:600}@media print{body{margin:28px auto}}</style></head><body><h1>${escapeHtml(cv.name)}</h1><p><strong>${escapeHtml(cv.headline)}</strong></p><h2>Professional summary</h2><p>${escapeHtml(cv.summary)}</p><h2>Key skills</h2><p class="skills">${escapeHtml(cv.skills)}</p><h2>Experience</h2><p>${escapeHtml(cv.experience)}</p><h2>Education</h2><p>${escapeHtml(cv.education)}</p></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}
