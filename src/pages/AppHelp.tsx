import { useEffect, useState } from 'react';
import { Bell, Camera, ChevronDown, Download, Fingerprint, FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsPwa } from '../lib/usePwaDisplayMode';
import { FAQ_QUESTIONS } from '../data/faq';

type InstallPlatform = 'android' | 'ios' | 'desktop' | 'other';

function detectPlatform(): InstallPlatform {
  const platform = navigator.platform || '';
  const userAgent = navigator.userAgent;
  const isIpadOs = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(userAgent) || isIpadOs) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  if (/Windows|Macintosh|Linux/i.test(userAgent)) return 'desktop';
  return 'other';
}

export default function AppHelp() {
  const isPwa = useIsPwa();
  const [platform, setPlatform] = useState<InstallPlatform>('other');
  const [openQuestion, setOpenQuestion] = useState(0);

  useEffect(() => setPlatform(detectPlatform()), []);

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#8A867E]">RoleWave support</div>
        <h1 className="mt-1 text-3xl font-bold text-[#1A1A1A]">Help &amp; support</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">Get the most out of RoleWave on your phone, tablet, or computer.</p>

        <div className="mt-6 space-y-3">
          {!isPwa && (
            <section className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <Download className="mt-0.5 shrink-0 text-[#1D9E75]" size={21} />
                <div>
                  <h2 className="font-semibold text-[#1A1A1A]">Install the RoleWave app</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
                    {platform === 'ios'
                      ? 'In Safari, tap Share, choose Add to Home Screen, then tap Add.'
                      : platform === 'android'
                        ? 'In Chrome, open the browser menu and choose Install app or Add to Home screen.'
                        : 'Use Chrome or Edge and choose Install RoleWave from the browser address bar or menu.'}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Fingerprint className="mt-0.5 shrink-0 text-[#1D9E75]" size={21} />
              <div>
                <h2 className="font-semibold text-[#1A1A1A]">Passkey sign-in</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">Enable it in Account security to use your fingerprint, face unlock, or device screen lock. Your biometric information stays on your device.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 shrink-0 text-[#1D9E75]" size={21} />
              <div>
                <h2 className="font-semibold text-[#1A1A1A]">Notifications</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">Use the Notifications section in Settings to turn alerts on or off. If the device blocks them, re-enable RoleWave in your browser or device settings.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Camera className="mt-0.5 shrink-0 text-[#1D9E75]" size={21} />
              <div>
                <h2 className="font-semibold text-[#1A1A1A]">Camera and microphone</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">RoleWave asks for access only when an interview or voice feature needs it. If access is denied, re-enable camera and microphone for RoleWave in your browser or device settings.</p>
              </div>
            </div>
          </section>

          <section id="faq" className="scroll-mt-6 rounded-[28px] border border-[#D3D1C7] bg-white p-5 sm:p-6">
            <div className="mb-2">
              <h2 className="font-semibold text-[#1A1A1A]">Frequently asked questions</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Quick answers about finding opportunities and using RoleWave.</p>
            </div>
            <div className="divide-y divide-[#E5E1D8]">
              {FAQ_QUESTIONS.map((item, index) => {
                const isOpen = openQuestion === index;
                return (
                  <div key={item.question}>
                    <button type="button" onClick={() => setOpenQuestion(isOpen ? -1 : index)} aria-expanded={isOpen} className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:text-[#0F6E56]">
                      <span className="flex-1 text-sm font-semibold text-[#1A1A1A]">{item.question}</span>
                      <ChevronDown size={17} className={`shrink-0 text-[#8A867E] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#0F6E56]' : ''}`} />
                    </button>
                    {isOpen && <p className="pb-4 pr-6 text-sm leading-6 text-[#5F5E5A]">{item.answer}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 sm:p-6">
            <div className="mb-3">
              <h2 className="font-semibold text-[#1A1A1A]">Policies and data choices</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#5F5E5A]">Read how RoleWave handles your information and platform use.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Link to="/privacy" className="inline-flex items-center gap-2 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3 text-sm font-semibold text-[#0F6E56] hover:border-[#5DCAA5]"><ShieldCheck size={16} /> Privacy Policy</Link>
              <Link to="/terms" className="inline-flex items-center gap-2 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3 text-sm font-semibold text-[#0F6E56] hover:border-[#5DCAA5]"><FileText size={16} /> Terms of Service</Link>
              <Link to="/cookie-policy" className="inline-flex items-center gap-2 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3 text-sm font-semibold text-[#0F6E56] hover:border-[#5DCAA5]"><FileText size={16} /> Cookie Policy</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
