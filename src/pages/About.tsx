import { Mail, Twitter, Instagram, Linkedin, AlertTriangle, ArrowRight, Check, Zap } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F1EFE8]">
      {/* Hero */}
      <div className="bg-[#1D9E75] px-4 sm:px-10 py-10 sm:py-16 grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
        <div>
          <h1 className="text-[28px] sm:text-[36px] font-bold text-white leading-[1.2] mb-3 tracking-[-0.5px]">
            Nigeria's verified<br />tech job board.
          </h1>
          <p className="text-sm sm:text-base text-white/65 leading-relaxed">
            Every listing is manually checked before it goes live. No scams, no fake roles. Just real opportunities for Nigerian tech and digital talent.
          </p>
        </div>
        <div className="flex gap-3 sm:gap-4 flex-wrap">
          {[
            { n: '52', l: 'Live jobs' },
            { n: '34', l: 'Companies' },
            { n: '100%', l: 'Verified' },
            { n: 'Free', l: 'Always' },
          ].map((stat) => (
            <div key={stat.l} className="bg-white/10 rounded-xl px-4 sm:px-6 py-4 sm:py-5 flex-1 min-w-[100px] sm:min-w-[120px]">
              <div className="text-[22px] sm:text-[28px] font-bold text-white mb-1">{stat.n}</div>
              <div className="text-xs sm:text-[13px] text-white/55">{stat.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-10 py-8 sm:py-12 grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
        <div>
          <div className="text-lg sm:text-xl font-bold text-[#1A1A1A] mb-6">How it works</div>

          <div className="flex gap-4 mb-6">
            <div className="w-9 h-9 rounded-full bg-[#E1F5EE] text-[#085041] flex items-center justify-center text-base font-bold flex-shrink-0">
              <ArrowRight size={16} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[#1A1A1A] mb-1">Employer posts a job</div>
              <div className="text-[13px] text-[#5F5E5A] leading-relaxed">
                Fill out our simple form in about 3 minutes. Free for everyone, always. No account needed to get started.
              </div>
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <div className="w-9 h-9 rounded-full bg-[#E1F5EE] text-[#085041] flex items-center justify-center text-base font-bold flex-shrink-0">
              <Check size={16} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[#1A1A1A] mb-1">We verify it manually</div>
              <div className="text-[13px] text-[#5F5E5A] leading-relaxed">
                Our team checks the company is real, the contact is valid, and the role is genuine before anything goes live.
              </div>
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <div className="w-9 h-9 rounded-full bg-[#E1F5EE] text-[#085041] flex items-center justify-center text-base font-bold flex-shrink-0">
              <Zap size={16} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[#1A1A1A] mb-1">Published within 24 hours</div>
              <div className="text-[13px] text-[#5F5E5A] leading-relaxed">
                Verified jobs go live and immediately start reaching Nigeria's best tech and digital talent.
              </div>
            </div>
          </div>

          <div className="bg-[#F1EFE8] rounded-xl p-4 sm:p-5 mt-6 flex gap-3 sm:gap-4">
            <AlertTriangle size={24} className="text-[#633806] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[15px] font-semibold text-[#1A1A1A] mb-1.5">Spotted a fake listing?</div>
              <div className="text-[13px] text-[#5F5E5A] leading-relaxed">
                Every job has a Report button. One verified report and we remove it immediately. Help us keep Career Connect clean and trustworthy for everyone.
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-lg sm:text-xl font-bold text-[#1A1A1A] mb-6">Get in touch</div>

          <div className="flex items-center gap-3 py-3.5 border-b border-[#D3D1C7]">
            <Mail size={18} className="text-[#1D9E75] w-6 text-center" />
            <div>
              <div className="text-xs text-[#B4B2A9] mb-0.5">Email</div>
              <div className="text-sm font-medium text-[#1D9E75]">hello@careerconnect.ng</div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3.5 border-b border-[#D3D1C7]">
            <Twitter size={18} className="text-[#1D9E75] w-6 text-center" />
            <div>
              <div className="text-xs text-[#B4B2A9] mb-0.5">Twitter / X</div>
              <div className="text-sm font-medium text-[#1D9E75]">@careerconnect</div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3.5 border-b border-[#D3D1C7]">
            <Instagram size={18} className="text-[#1D9E75] w-6 text-center" />
            <div>
              <div className="text-xs text-[#B4B2A9] mb-0.5">Instagram</div>
              <div className="text-sm font-medium text-[#1D9E75]">@careerconnect</div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3.5">
            <Linkedin size={18} className="text-[#1D9E75] w-6 text-center" />
            <div>
              <div className="text-xs text-[#B4B2A9] mb-0.5">LinkedIn</div>
              <div className="text-sm font-medium text-[#1D9E75]">Career Connect Nigeria</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
