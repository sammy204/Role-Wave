import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-[#D3D1C7] bg-white/80 backdrop-blur px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="block text-sm font-bold text-[#1D9E75]">RoleWave</span>
          <span className="mt-1 block text-xs text-[#B4B2A9]">Verified roles. Clean process. Less noise.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/about" className="ghost-chip">About</Link>
        </div>
        <span className="text-xs text-[#B4B2A9]">&copy; 2026 RoleWave</span>
      </div>
    </footer>
  );
}
