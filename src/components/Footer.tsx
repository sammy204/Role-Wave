import { Link } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

const socialLinks = [
  {
    name: 'X',
    href: 'https://x.com/rolewavecv',
    color: '#000000',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: 'Reddit',
    href: 'https://reddit.com/r/rolewave',
    color: '#FF4500',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M22 12.05c0-1.1-.9-2-2-2-.53 0-1.02.21-1.37.55-1.35-.9-3.18-1.48-5.2-1.56l1-4.4 3.2.72a1.5 1.5 0 1 0 .16-.98l-3.6-.81a.5.5 0 0 0-.6.38l-1.12 4.95c-2.05.06-3.9.64-5.26 1.55A1.98 1.98 0 0 0 4 12.05c0 .78.42 1.46 1.05 1.83a3.3 3.3 0 0 0-.05.58c0 2.6 3.13 4.7 7 4.7s7-2.1 7-4.7c0-.2-.02-.39-.05-.58.63-.37 1.05-1.05 1.05-1.83zM8.5 13.4a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm7.15 2.75c-.77.77-2.23 1.04-3.65 1.04s-2.88-.27-3.65-1.04a.4.4 0 0 1 .56-.56c.53.53 1.72.82 3.09.82s2.56-.29 3.09-.82a.4.4 0 0 1 .56.56zm-.15-1.65a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2z" />
      </svg>
    ),
  },
  {
    name: 'Telegram',
    href: 'https://t.me/rolewave',
    color: '#229ED9',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M21.6 3.3 2.7 10.59c-.78.3-.77 1.38.02 1.67l4.8 1.77 1.8 5.64c.24.75 1.2.99 1.77.45l2.68-2.54 4.69 3.43c.68.5 1.64.14 1.84-.68l3.2-15.7c.18-.88-.67-1.65-1.52-1.33ZM9.1 13.5l9.35-6.08-6.9 7.1-.27 2.24-1.1-3.26-1.08-.4Zm4.94 2.48.28-2.35 4.05-4.17-3.48 5.23-.85 1.29Z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setSubmitting(true);
    setSubscribed(false);
    setSubscriptionError('');

    const { error } = await supabase.from('email_subscriptions').insert({ email: normalizedEmail });

    if (error) {
      if (error.code === '23505') {
        setSubscribed(true);
        setEmail('');
      } else {
        setSubscriptionError('We could not save your subscription. Please try again.');
      }
      setSubmitting(false);
      return;
    }

    setSubscribed(true);
    setEmail('');
    setSubmitting(false);
  };

  return (
    <footer className="border-t border-[#2B5B50] bg-[#123D35] px-5 py-14 text-white sm:px-8 sm:py-16 lg:px-0">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-5">
          {/* Brand + newsletter */}
          <div className="col-span-2 lg:col-span-2">
            <Link to="/" aria-label="RoleWave home" className="inline-flex">
            <img
              src="/rolewave-horizontal-tagline.png"
              alt="RoleWave — Your Career, Rising."
              className="h-10 w-auto object-contain object-left brightness-0 invert"
            />
            </Link>
            <span className="mt-3 block max-w-[300px] text-sm leading-6 text-white/60">
              A more considered way to find work.
            </span>

            <form onSubmit={handleSubscribe} className="mt-4 flex max-w-[320px] gap-2">
              <label htmlFor="footer-newsletter" className="sr-only">
                Email address
              </label>
              <input
                id="footer-newsletter"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs text-white outline-none placeholder:text-white/40 focus:border-[#8AD7B8] focus:ring-1 focus:ring-[#8AD7B8]"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-[#E3F4EC] px-3 py-2 text-xs font-bold text-[#123D35] transition hover:bg-white"
              >
                {submitting ? 'Saving...' : subscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </form>
            {subscribed && (
              <span className="mt-1 block text-xs text-[#1D9E75]">
                You are on the list.
              </span>
            )}
            {subscriptionError && <span className="mt-1 block text-xs text-[#F0C6A5]">{subscriptionError}</span>}
          </div>

          {/* Company */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#8AD7B8]">
              Company
            </span>
            <nav className="mt-3 flex flex-col gap-2">
              <Link to="/about" className="text-sm text-white/60 transition-colors hover:text-white">
                About Us
              </Link>
              <Link to="/blog" className="text-sm text-white/60 transition-colors hover:text-white">
                Blog
              </Link>
              <Link to="/contact" className="text-sm text-white/60 transition-colors hover:text-white">
                Contact
              </Link>
              <Link to="/faq" className="text-sm text-white/60 transition-colors hover:text-white">
                FAQ
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#8AD7B8]">
              Legal
            </span>
            <nav className="mt-3 flex flex-col gap-2">
              <Link to="/terms" className="text-sm text-white/60 transition-colors hover:text-white">
                Terms of Service
              </Link>
              <Link to="/privacy" className="text-sm text-white/60 transition-colors hover:text-white">
                Privacy Policy
              </Link>
              <Link to="/cookie-policy" className="text-sm text-white/60 transition-colors hover:text-white">
                Cookie Policy
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-white/40">&copy; 2026 RoleWave</span>
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                style={{ color: social.color }}
                className="text-white opacity-60 transition hover:scale-110 hover:opacity-100"
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
