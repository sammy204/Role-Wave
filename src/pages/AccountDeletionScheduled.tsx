import { Link, useSearchParams } from 'react-router-dom';

export default function AccountDeletionScheduled() {
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');
  const formattedDate = date
    ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'long' }).format(new Date(date))
    : '10 days from now';

  return (
    <main className="page-shell flex items-center justify-center px-4 py-12">
      <section className="panel w-full max-w-lg rounded-[28px] p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E1F5EE] text-2xl text-[#1D9E75]">✓</div>
        <h1 className="mt-5 text-2xl font-bold text-[#1A1A1A]">We hate to see you go</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F5E5A]">
          Your account has been hidden and is scheduled for permanent deletion on <strong>{formattedDate}</strong>.
          If you change your mind, log in before then and your account will be reactivated.
        </p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-white">Return home</Link>
      </section>
    </main>
  );
}
