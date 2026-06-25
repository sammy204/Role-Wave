import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-10 py-4 sm:py-[18px] border-t border-[#D3D1C7] bg-white gap-3 sm:gap-0">
      <span className="text-sm font-bold text-[#1D9E75]">Career Connect</span>
      <div className="flex gap-4 sm:gap-6">
        <Link to="/jobs" className="text-xs text-[#B4B2A9] hover:text-[#5F5E5A] transition-colors">Browse jobs</Link>
        <Link to="/post" className="text-xs text-[#B4B2A9] hover:text-[#5F5E5A] transition-colors">Post a job</Link>
        <Link to="/about" className="text-xs text-[#B4B2A9] hover:text-[#5F5E5A] transition-colors">About</Link>
      </div>
      <span className="text-xs text-[#B4B2A9]">&copy; 2026 Career Connect</span>
    </footer>
  );
}
