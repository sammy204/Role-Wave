import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ_QUESTIONS } from '../data/faq';

export default function Faq() {
  const [openQuestion, setOpenQuestion] = useState(0);

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-[900px] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section
          className="relative overflow-hidden rounded-[34px] px-5 py-10 text-white shadow-[0_28px_80px_rgba(29,158,117,0.18)] sm:px-10 sm:py-14"
          style={{ background: 'linear-gradient(135deg, #0D3028 0%, #12684F 58%, #1D9E75 100%)' }}
        >
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#5B4088]/25 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.7px] text-[#B9F4D7] backdrop-blur-xl">
              Help centre
            </div>
            <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-[-1.4px] sm:text-[58px]">Frequently asked questions.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/72 sm:text-base">
              A few answers about finding opportunities and using RoleWave as a candidate.
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[34px] border border-white/70 bg-white/72 p-4 shadow-[0_24px_70px_rgba(26,26,26,0.06)] backdrop-blur-xl sm:p-7">
          <div className="divide-y divide-[#E5E1D8]">
            {FAQ_QUESTIONS.map((item, index) => {
              const isOpen = openQuestion === index;
              return (
                <div key={item.question}>
                  <button
                    type="button"
                    onClick={() => setOpenQuestion(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 py-5 text-left transition-colors hover:text-[#0F6E56]"
                  >
                    <span className="flex-1 text-[15px] font-semibold text-[#1A1A1A] sm:text-base">{item.question}</span>
                    <ChevronDown size={18} className={`shrink-0 text-[#8A867E] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#0F6E56]' : ''}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="min-h-0 overflow-hidden">
                      <p className="pb-5 pr-6 text-sm leading-6 text-[#5F5E5A]">{item.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
