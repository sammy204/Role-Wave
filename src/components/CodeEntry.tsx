import { useEffect, useRef } from 'react';

export default function CodeEntry({
  value,
  onChange,
  placeholder = 'Enter 6-digit code',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div>
      <input
        ref={ref}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(v);
        }}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#D3D1C7] bg-white/85 px-4 py-3.5 text-sm text-[#1A1A1A] outline-none transition-colors placeholder:text-[#B4B2A9] focus:border-[#1D9E75]"
        aria-label="Sign-in code"
      />
    </div>
  );
}
