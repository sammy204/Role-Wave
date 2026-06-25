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
    <nav className="flex items-center justify-between px-4 sm:px-10 h-[60px] bg-white border-b border-[#D3D1C7] relative z-50">
      <Link to="/" className="flex items-center gap-[9px]">
        <div className="w-[30px] h-[30px] bg-[#1D9E75] rounded-lg flex items-center justify-center text-white">
          <Briefcase size={15} />
        </div>
        <span className="text-[17px] font-bold text-[#1A1A1A]">Career Connect</span>
      </Link>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-8">
        <Link
          to="/jobs"
          className={`text-sm font-medium transition-colors ${isActive('/jobs') || path === '/' ? 'text-[#1D9E75]' : 'text-[#5F5E5A] hover:text-[#1A1A1A]'}`}
        >
          Browse jobs
        </Link>
        <Link
          to="/about"
          className={`text-sm font-medium transition-colors ${isActive('/about') ? 'text-[#1D9E75]' : 'text-[#5F5E5A] hover:text-[#1A1A1A]'}`}
        >
          About
        </Link>
      </div>

      <div className="hidden md:block">
        <Link
          to="/post"
          className="text-[13px] font-semibold text-white bg-[#1D9E75] px-[18px] py-2 rounded-lg hover:bg-[#168a63] transition-colors"
        >
          + Post a job
        </Link>
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden p-2 text-[#1A1A1A]"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-[60px] left-0 right-0 bg-white border-b border-[#D3D1C7] shadow-lg md:hidden flex flex-col p-4 gap-3 z-50">
          <Link
            to="/jobs"
            onClick={() => setMenuOpen(false)}
            className={`text-sm font-medium py-2 ${isActive('/jobs') || path === '/' ? 'text-[#1D9E75]' : 'text-[#5F5E5A]'}`}
          >
            Browse jobs
          </Link>
          <Link
            to="/about"
            onClick={() => setMenuOpen(false)}
            className={`text-sm font-medium py-2 ${isActive('/about') ? 'text-[#1D9E75]' : 'text-[#5F5E5A]'}`}
          >
            About
          </Link>
          <Link
            to="/post"
            onClick={() => setMenuOpen(false)}
            className="text-[13px] font-semibold text-white bg-[#1D9E75] px-[18px] py-2.5 rounded-lg text-center"
          >
            + Post a job
          </Link>
        </div>
      )}
    </nav>
  );
}
