import { FormEvent, useState } from 'react';
import { ArrowRight, ArrowUpRight, Instagram, Linkedin, Mail, MessageCircle, Twitter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TurnstileWidget } from '../components/TurnstileWidget';

const channels = [
  { icon: Mail, label: 'Email us', value: 'support@rolewave.cv', href: 'mailto:support@rolewave.cv' },
  { icon: Twitter, label: 'Twitter / X', value: '@rolewavecv', href: 'https://x.com/rolewavecv' },
  { icon: Instagram, label: 'Instagram', value: '@rolewave', href: 'https://instagram.com/rolewave' },
  { icon: Linkedin, label: 'LinkedIn', value: 'RoleWave Nigeria', href: 'https://linkedin.com/company/rolewave' },
];

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('General support');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const { error: functionError } = await supabase.functions.invoke('submit-support-request', {
      body: { name, email, category, message, website, captchaToken },
    });

    if (functionError) {
      setError('We couldn’t send your message. Please try again.');
      setSubmitting(false);
      return;
    }

    setName('');
    setEmail('');
    setCategory('General support');
    setMessage('');
    setWebsite('');
    setCaptchaToken('');
    setSent(true);
    setSubmitting(false);
  };

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <section
          className="relative overflow-hidden rounded-[34px] px-5 py-10 text-white shadow-[0_28px_80px_rgba(29,158,117,0.18)] sm:px-10 sm:py-14"
          style={{ background: 'linear-gradient(135deg, #0D3028 0%, #12684F 58%, #1D9E75 100%)' }}
        >
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#5B4088]/25 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.7px] text-[#B9F4D7] backdrop-blur-xl">
              Contact RoleWave
            </div>
            <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-[-1.4px] sm:text-[58px]">
              Let&apos;s keep the conversation moving.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/72 sm:text-base">
              Whether you have a question, spotted something that needs attention, or want to work with us, choose the route that works best for you.
            </p>
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/78 p-5 shadow-[0_24px_70px_rgba(26,26,26,0.06)] backdrop-blur-xl sm:p-7">
            <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-[#1D9E75]/10 blur-3xl" />
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E1F5EE] text-[#085041]">
                <MessageCircle size={21} />
              </div>
              <p className="mt-7 text-[10px] font-bold uppercase tracking-[1.7px] text-[#1D9E75]">Contact support</p>
              <h2 className="font-display mt-2 text-[32px] font-bold leading-[1.05] text-[#1A1A1A]">How can we help?</h2>
              <p className="mt-4 text-sm leading-6 text-[#5F5E5A]">
                Send us the details and the RoleWave team will get back to you by email.
              </p>

              {sent ? (
                <div className="mt-6 rounded-2xl border border-[#B9E8D4] bg-[#E1F5EE] p-4 text-sm leading-6 text-[#085041]">
                  Thanks for contacting RoleWave. Our support team will review your message and reply by email.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-[#5F5E5A]">
                      Name
                      <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} className="mt-1.5 w-full rounded-xl border border-[#D3D1C7] bg-white px-3 py-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1D9E75]" />
                    </label>
                    <label className="text-xs font-semibold text-[#5F5E5A]">
                      Email
                      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} className="mt-1.5 w-full rounded-xl border border-[#D3D1C7] bg-white px-3 py-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1D9E75]" />
                    </label>
                  </div>
                  <label className="block text-xs font-semibold text-[#5F5E5A]">
                    What can we help with?
                    <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D3D1C7] bg-white px-3 py-3 text-sm font-normal text-[#1A1A1A] outline-none focus:border-[#1D9E75]">
                      <option>General support</option>
                      <option>Account help</option>
                      <option>Job listing</option>
                      <option>Payment</option>
                      <option>Technical issue</option>
                      <option>Safety report</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#5F5E5A]">
                    Message
                    <textarea value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={5000} rows={5} className="mt-1.5 w-full resize-y rounded-xl border border-[#D3D1C7] bg-white px-3 py-3 text-sm font-normal leading-6 text-[#1A1A1A] outline-none focus:border-[#1D9E75]" />
                  </label>
                  <label className="hidden" aria-hidden="true">
                    Website
                    <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
                  </label>
                  <TurnstileWidget onVerify={setCaptchaToken} />
                  {error && <p className="text-xs leading-5 text-red-700">{error}</p>}
                  <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-2xl bg-[#1D9E75] px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,110,86,.22)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
                    {submitting ? 'Sending…' : 'Send message'} <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </div>
          </section>

          <section className="rounded-[32px] border border-white/70 bg-white/72 p-4 shadow-[0_24px_70px_rgba(26,26,26,0.06)] backdrop-blur-xl sm:p-6">
            <div className="mb-3 px-2">
              <p className="text-[10px] font-bold uppercase tracking-[1.7px] text-[#1D9E75]">Find us elsewhere</p>
              <h2 className="font-display mt-1 text-[28px] font-bold leading-none text-[#1A1A1A]">Choose your channel</h2>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {channels.slice(1).map((channel) => {
                const Icon = channel.icon;
                return (
                  <a
                    key={channel.label}
                    href={channel.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-2xl border border-[#E5E1D8] bg-[#FBFAF7]/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5DCAA5] hover:bg-white"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase tracking-[1px] text-[#B4B2A9]">{channel.label}</div>
                      <div className="mt-1 truncate text-sm font-semibold text-[#1A1A1A]">{channel.value}</div>
                    </div>
                    <ArrowUpRight size={16} className="text-[#8A867E] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-[#D3D1C7] bg-[#F1EFE8]/70 px-4 py-3.5 text-xs leading-5 text-[#5F5E5A]">
              For suspicious listings or account concerns, include the job title, company name, and what you noticed so we can investigate quickly.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
