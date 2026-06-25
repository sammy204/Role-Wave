import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Briefcase, Menu, X } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const path = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (route: string) => {
    if (route === '/') return path === '/';
    return path.startsWith(route);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/88 backdrop-blur-xl shadow-[0_6px_30px_rgba(26,26,26,0.05)]">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-[#1D9E75] text-white shadow-[0_10px_18px_rgba(29,158,117,0.18)]">
            <Briefcase size={15} />
          </div>
          <div className="leading-tight">
            <span className="block text-[17px] font-bold text-[#1A1A1A]">RoleWave</span>
            <span className="hidden text-[11px] uppercase tracking-[0.18em] text-[#B4B2A9] sm:block">Verified jobs board</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-2 rounded-full border border-[#D3D1C7] bg-white/80 p-1.5 shadow-[0_8px_20px_rgba(26,26,26,0.04)] md:flex">
        <Link
          to="/jobs"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${isActive('/jobs') || path === '/' ? 'bg-[#E1F5EE] text-[#085041]' : 'text-[#5F5E5A] hover:bg-[#F1EFE8] hover:text-[#1A1A1A]'}`}
        >
          Browse jobs
        </Link>
        <Link
          to="/about"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${isActive('/about') ? 'bg-[#E1F5EE] text-[#085041]' : 'text-[#5F5E5A] hover:bg-[#F1EFE8] hover:text-[#1A1A1A]'}`}
        >
          About
        </Link>
      </div>

        <div className="hidden md:block">
        <Link
          to="/post"
          className="inline-flex items-center gap-2 rounded-full bg-[#1D9E75] px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(29,158,117,0.18)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#168a63]"
        >
          + Post a job
        </Link>
      </div>

        {/* Mobile hamburger */}
        <button
          className="rounded-full border border-[#D3D1C7] bg-white p-2 text-[#1A1A1A] shadow-[0_8px_18px_rgba(26,26,26,0.04)] md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Mobile menu */}
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Close mobile menu"
              className="fixed inset-0 z-40 cursor-default bg-black/20 md:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute left-0 right-0 top-[68px] z-50 mx-3 rounded-[24px] border border-[#D3D1C7] bg-white px-4 py-4 shadow-[0_18px_38px_rgba(26,26,26,0.12)] md:hidden">
              <div className="mb-3 rounded-2xl bg-[#F7F6F2] p-1.5">
                <Link
                  to="/jobs"
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-[14px] px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive('/jobs') || path === '/' ? 'bg-white text-[#085041] shadow-sm' : 'text-[#5F5E5A]'
                  }`}
                >
                  Browse jobs
                </Link>
                <Link
                  to="/about"
                  onClick={() => setMenuOpen(false)}
                  className={`mt-1 block rounded-[14px] px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive('/about') ? 'bg-white text-[#085041] shadow-sm' : 'text-[#5F5E5A]'
                  }`}
                >
                  About
                </Link>
              </div>
              <Link
                to="/post"
                onClick={() => setMenuOpen(false)}
                className="block rounded-[16px] bg-[#1D9E75] px-[18px] py-3 text-center text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(29,158,117,0.18)]"
              >
                + Post a job
              </Link>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
