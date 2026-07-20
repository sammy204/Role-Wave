import { Link } from 'react-router-dom';
import { useState } from 'react';

const socialLinks = [
  {
    name: 'X',
    href: 'https://x.com/rolewave',
    color: '#000000',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/rolewave',
    color: '#E1306C',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    href: 'https://facebook.com/rolewave',
    color: '#1877F2',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M13.5 21v-8.1h2.7l.4-3.2h-3.1V7.6c0-.9.25-1.55 1.58-1.55h1.68V3.2C15.9 3.1 15 3 13.94 3 11.7 3 10.16 4.35 10.16 6.9v2.8H7.44v3.2h2.72V21z" />
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
    name: 'WhatsApp',
    href: 'https://wa.me/yournumber',
    color: '#25D366',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M17.47 14.38c-.29-.15-1.7-.84-1.96-.93-.26-.1-.46-.15-.65.14-.2.29-.75.93-.92 1.12-.17.2-.34.22-.63.08-.29-.15-1.22-.45-2.32-1.43-.86-.76-1.44-1.7-1.6-1.99-.17-.29-.02-.44.13-.59.13-.13.29-.34.44-.5.15-.18.2-.3.29-.5.1-.19.05-.36-.02-.5-.08-.15-.65-1.57-.9-2.15-.24-.57-.48-.49-.65-.5-.17-.01-.36-.01-.56-.01s-.5.07-.77.36c-.26.29-1 .98-1 2.4s1.03 2.79 1.17 2.98c.15.19 2.03 3.1 4.93 4.34.69.3 1.22.48 1.64.61.69.22 1.31.19 1.81.11.55-.08 1.7-.7 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34z" />
        <path d="M12.02 2C6.5 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.08-1.33A9.94 9.94 0 0 0 12.02 22C17.53 22 22 17.52 22 12S17.53 2 12.02 2zm0 18.15c-1.6 0-3.1-.43-4.4-1.19l-.32-.19-3.02.79.81-2.94-.2-.31A8.16 8.16 0 0 1 3.85 12c0-4.5 3.67-8.16 8.17-8.16 4.5 0 8.15 3.66 8.15 8.16 0 4.5-3.65 8.15-8.15 8.15z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // TODO: wire up to your actual newsletter provider / Supabase table
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="border-t border-[#D3D1C7] bg-white/80 backdrop-blur px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-5">
          {/* Brand + newsletter */}
          <div className="col-span-2 lg:col-span-2">
            <span className="block text-sm font-bold text-[#1D9E75]">RoleWave</span>
            <span className="mt-1 block max-w-[280px] text-xs text-[#B4B2A9]">
              Verified roles. Clean process. Less noise.
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
                className="w-full rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs text-[#1D1D1D] outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#17805e]"
              >
                {subscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </form>
            {subscribed && (
              <span className="mt-1 block text-xs text-[#1D9E75]">
                You're on the list.
              </span>
            )}
          </div>

          {/* Company */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#1D1D1D]">
              Company
            </span>
            <nav className="mt-3 flex flex-col gap-2">
              <Link to="/about" className="text-xs text-[#6B6960] hover:text-[#1D9E75]">
                About Us
              </Link>
              <Link to="/blog" className="text-xs text-[#6B6960] hover:text-[#1D9E75]">
                Blog
              </Link>
              <Link to="/contact" className="text-xs text-[#6B6960] hover:text-[#1D9E75]">
                Contact
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#1D1D1D]">
              Legal
            </span>
            <nav className="mt-3 flex flex-col gap-2">
              <Link to="/terms" className="text-xs text-[#6B6960] hover:text-[#1D9E75]">
                Terms of Service
              </Link>
              <Link to="/privacy" className="text-xs text-[#6B6960] hover:text-[#1D9E75]">
                Privacy Policy
              </Link>
              <Link to="/security" className="text-xs text-[#6B6960] hover:text-[#1D9E75]">
                Security
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[#D3D1C7] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#B4B2A9]">&copy; 2026 RoleWave</span>
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                style={{ color: social.color }}
                className="opacity-90 transition hover:opacity-100 hover:scale-110"
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