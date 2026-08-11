import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailX } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let alive = true;

    if (!token) {
      setState('error');
      return () => {
        alive = false;
      };
    }

    void (async () => {
      const { data, error } = await supabase.rpc('unsubscribe_email', { p_token: token });
      if (alive) setState(!error && data === true ? 'success' : 'error');
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <div className="page-shell items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/80 p-7 text-center shadow-[0_24px_70px_rgba(26,26,26,0.08)] backdrop-blur-xl sm:p-10">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${state === 'success' ? 'bg-[#E1F5EE] text-[#085041]' : 'bg-[#F1EFE8] text-[#5F5E5A]'}`}>
          {state === 'success' ? <CheckCircle2 size={25} /> : <MailX size={25} />}
        </div>
        {state === 'loading' && (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-[#1A1A1A]">Updating your preferences</h1>
            <p className="mt-3 text-sm leading-6 text-[#6B6960]">Please wait a moment.</p>
          </>
        )}
        {state === 'success' && (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-[#1A1A1A]">You are unsubscribed</h1>
            <p className="mt-3 text-sm leading-6 text-[#6B6960]">You will no longer receive RoleWave newsletter emails at this address.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-[#1A1A1A]">Link unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-[#6B6960]">This unsubscribe link is missing or has expired.</p>
          </>
        )}
        <Link to="/" className="mt-7 inline-flex rounded-xl bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white hover:bg-[#168a63]">
          Back to RoleWave
        </Link>
      </div>
    </div>
  );
}