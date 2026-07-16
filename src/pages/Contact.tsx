import { Mail, Twitter, Instagram, Linkedin } from 'lucide-react';

const channels = [
  { icon: Mail, label: 'Email', value: 'hello@rolewave.ng', href: 'mailto:hello@rolewave.ng' },
  { icon: Twitter, label: 'Twitter / X', value: '@rolewave', href: 'https://twitter.com/rolewave' },
  { icon: Instagram, label: 'Instagram', value: '@rolewave', href: 'https://instagram.com/rolewave' },
  { icon: Linkedin, label: 'LinkedIn', value: 'RoleWave Nigeria', href: 'https://linkedin.com/company/rolewave' },
];

export default function Contact() {
  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[640px]">
        <h1 className="font-serif text-2xl font-bold text-ink sm:text-3xl">Contact us</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We're building a proper contact form. For now, the fastest way to reach us is directly below.
        </p>

        <div className="mt-6 rounded-panel border border-line bg-surface p-2 shadow-card">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <a
                key={channel.label}
                href={channel.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors duration-200 hover:bg-paper"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-text">
                  <Icon size={16} />
                </div>
                <div>
                  <div className="text-xs text-faint">{channel.label}</div>
                  <div className="text-sm font-semibold text-ink">{channel.value}</div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}