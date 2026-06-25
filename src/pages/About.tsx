import { Mail, Twitter, Instagram, Linkedin, AlertTriangle, ArrowRight, Check, Zap } from 'lucide-react';

export default function About() {
  return (
    <div className="page-shell">
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-4 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="rounded-[32px] bg-[#1D9E75] px-4 py-10 shadow-[0_24px_60px_rgba(29,158,117,0.18)] sm:px-8 sm:py-14">
          <h1 className="font-display mb-3 text-[30px] font-bold leading-[1.08] tracking-[-1px] text-white sm:text-[42px]">
            Nigeria's verified
            <br />
            tech job board.
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            Every listing is manually checked before it goes live. No scams, no fake roles. Just real opportunities for Nigerian tech and digital talent.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { n: '52', l: 'Live jobs' },
              { n: '34', l: 'Companies' },
              { n: '100%', l: 'Verified' },
              { n: 'Free', l: 'Always' },
            ].map((stat) => (
              <div key={stat.l} className="rounded-[22px] border border-white/15 bg-white/10 px-4 py-4 text-white">
                <div className="mb-1 text-[22px] font-bold sm:text-[28px]">{stat.n}</div>
                <div className="text-xs text-white/60">{stat.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[32px] px-4 py-8 sm:px-8 sm:py-10">
          <div className="mb-6 text-lg font-bold text-[#1A1A1A] sm:text-xl">How it works</div>

          <div className="mb-6 flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-[#085041]">
              <ArrowRight size={16} />
            </div>
            <div>
              <div className="mb-1 text-[15px] font-semibold text-[#1A1A1A]">Employer posts a job</div>
              <div className="text-[13px] leading-relaxed text-[#5F5E5A]">
                Fill out our simple form in about 3 minutes. Free for everyone, always. No account needed to get started.
              </div>
            </div>
          </div>

          <div className="mb-6 flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-[#085041]">
              <Check size={16} />
            </div>
            <div>
              <div className="mb-1 text-[15px] font-semibold text-[#1A1A1A]">We verify it manually</div>
              <div className="text-[13px] leading-relaxed text-[#5F5E5A]">
                Our team checks the company is real, the contact is valid, and the role is genuine before anything goes live.
              </div>
            </div>
          </div>

          <div className="mb-6 flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-[#085041]">
              <Zap size={16} />
            </div>
            <div>
              <div className="mb-1 text-[15px] font-semibold text-[#1A1A1A]">Published within 24 hours</div>
              <div className="text-[13px] leading-relaxed text-[#5F5E5A]">
                Verified jobs go live and immediately start reaching Nigeria's best tech and digital talent.
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3 rounded-[24px] border border-[#D3D1C7] bg-[#FBFAF7] p-4 sm:gap-4 sm:p-5">
            <AlertTriangle size={24} className="mt-0.5 flex-shrink-0 text-[#633806]" />
            <div>
              <div className="mb-1.5 text-[15px] font-semibold text-[#1A1A1A]">Spotted a fake listing?</div>
              <div className="text-[13px] leading-relaxed text-[#5F5E5A]">
                Every job has a Report button. One verified report and we remove it immediately. Help us keep RoleWave clean and trustworthy for everyone.
              </div>
            </div>
          </div>
        </div>

        <div className="panel rounded-[32px] px-4 py-8 sm:px-8 sm:py-10 lg:col-span-2">
          <div className="mb-6 text-lg font-bold text-[#1A1A1A] sm:text-xl">Get in touch</div>

          <div className="flex items-center gap-3 border-b border-[#D3D1C7] py-4">
            <Mail size={18} className="w-6 text-[#1D9E75]" />
            <div>
              <div className="mb-0.5 text-xs text-[#B4B2A9]">Email</div>
              <div className="text-sm font-medium text-[#1D9E75]">hello@rolewave.ng</div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-[#D3D1C7] py-4">
            <Twitter size={18} className="w-6 text-[#1D9E75]" />
            <div>
              <div className="mb-0.5 text-xs text-[#B4B2A9]">Twitter / X</div>
              <div className="text-sm font-medium text-[#1D9E75]">@rolewave</div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-[#D3D1C7] py-4">
            <Instagram size={18} className="w-6 text-[#1D9E75]" />
            <div>
              <div className="mb-0.5 text-xs text-[#B4B2A9]">Instagram</div>
              <div className="text-sm font-medium text-[#1D9E75]">@rolewave</div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-4">
            <Linkedin size={18} className="w-6 text-[#1D9E75]" />
            <div>
              <div className="mb-0.5 text-xs text-[#B4B2A9]">LinkedIn</div>
              <div className="text-sm font-medium text-[#1D9E75]">RoleWave Nigeria</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
