import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, FileText, Search, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';

type MatchDimension = {
  name: string;
  weight: number;
  score: number | null;
  confidence: number;
  reasoning: string;
};

type MatchResult = {
  overall_score: number | null;
  data_coverage: number;
  dimensions: MatchDimension[];
};

type AppliedJobRow = {
  application_id: string;
  job_id: string;
  title: string;
  slug: string;
  company_name: string;
  logo_initials: string | null;
  avatar_color: string | null;
  match: MatchResult | null;
  matchLoading: boolean;
  matchError: boolean;
};

function ScorePill({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="rounded-full border border-line bg-white px-3 py-1 text-[12px] font-semibold text-muted">
        Not enough data yet
      </span>
    );
  }

  const tone =
    score >= 70
      ? 'bg-pill-green-bg text-pill-green-text border-pill-green-border'
      : score >= 40
        ? 'bg-pill-amber-bg text-pill-amber-text border-pill-amber-border'
        : 'bg-pill-red-bg text-pill-red-text border-pill-red-border';

  return (
    <span className={`rounded-full border px-3 py-1 text-[12px] font-bold ${tone}`}>
      {score}% match
    </span>
  );
}

function ComingSoonCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-dashed border-line bg-white/60 p-5 opacity-70">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-light text-accent-deep">
          <Icon size={17} />
        </div>
        <span className="rounded-full bg-faint/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
          Coming soon
        </span>
      </div>
      <div>
        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
        <p className="mt-1 text-[13px] leading-snug text-muted">{description}</p>
      </div>
    </div>
  );
}

export default function RolePilot() {
  const { session } = useAuth();
  const [rows, setRows] = useState<AppliedJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;

    let alive = true;

    void (async () => {
      setLoading(true);
      setLoadError(false);

      const { data, error } = await supabase
        .from('job_applications')
        .select(
          `id, job_id,
           jobs:job_id ( id, title, slug, companies:company_id ( name, logo_initials, avatar_color ) )`
        )
        .eq('candidate_profile_id', uid)
        .is('candidate_deleted_at', null)
        .neq('status', 'withdrawn')
        .order('created_at', { ascending: false });

      if (!alive) return;

      if (error || !data) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      const initial: AppliedJobRow[] = data
        .filter((row: any) => row.jobs)
        .map((row: any) => ({
          application_id: row.id,
          job_id: row.job_id,
          title: row.jobs.title,
          slug: row.jobs.slug,
          company_name: row.jobs.companies?.name ?? 'Unknown company',
          logo_initials: row.jobs.companies?.logo_initials ?? null,
          avatar_color: row.jobs.companies?.avatar_color ?? null,
          match: null,
          matchLoading: true,
          matchError: false,
        }));

      setRows(initial);
      setLoading(false);

      // Fetch match scores one at a time in the background so the list
      // renders immediately and scores fill in as they arrive.
      for (const row of initial) {
        try {
          const { data: matchData, error: matchErr } = await supabase.rpc('calculate_match_score', {
            p_candidate_id: uid,
            p_job_id: row.job_id,
          });

          if (!alive) return;

          setRows((prev) =>
            prev.map((r) =>
              r.job_id === row.job_id
                ? {
                    ...r,
                    match: matchErr ? null : (matchData as MatchResult),
                    matchLoading: false,
                    matchError: !!matchErr,
                  }
                : r
            )
          );
        } catch {
          if (!alive) return;
          setRows((prev) =>
            prev.map((r) => (r.job_id === row.job_id ? { ...r, matchLoading: false, matchError: true } : r))
          );
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [session?.user?.id]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-light text-accent-deep">
          <Sparkles size={22} />
        </div>
        <div>
          <h1 className="font-serif text-[26px] font-bold text-ink">Role Pilot</h1>
          <p className="mt-1 text-[14px] text-muted">
            Your AI assistant for the job search starting with clear, honest match breakdowns for the jobs
            you've applied to.
          </p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">Check your match</h2>

        {loading && <div className="rounded-panel border border-line bg-white p-5 text-[14px] text-muted">Loading your applications…</div>}

        {!loading && loadError && (
          <div className="rounded-panel border border-line bg-white p-5 text-[14px] text-muted">
            Couldn't load your applications right now. Try refreshing.
          </div>
        )}

        {!loading && !loadError && rows.length === 0 && (
          <div className="rounded-panel border border-line bg-white p-5 text-[14px] text-muted">
            You haven't applied to any jobs yet.{' '}
            <Link to="/jobs" className="font-semibold text-accent-deep hover:underline">
              Browse jobs
            </Link>{' '}
            to get started.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div
              key={row.job_id}
              className="flex items-center justify-between gap-4 rounded-panel border border-line bg-white p-4 shadow-card"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white"
                  style={{ backgroundColor: row.avatar_color ?? '#1D9E75' }}
                >
                  {row.logo_initials ?? row.company_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <Link
                    to={`/jobs/${row.slug}`}
                    className="block truncate text-[14px] font-semibold text-ink hover:text-accent-deep"
                  >
                    {row.title}
                  </Link>
                  <span className="block truncate text-[12px] text-muted">{row.company_name}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {row.matchLoading ? (
                  <span className="text-[12px] text-muted">Scoring…</span>
                ) : row.matchError ? (
                  <span className="text-[12px] text-muted">Score unavailable</span>
                ) : (
                  <ScorePill score={row.match?.overall_score ?? null} />
                )}
                <button
                  disabled
                  title="Full match explanations are coming soon"
                  className="cursor-not-allowed rounded-panel border border-line bg-white px-3 py-2 text-[12px] font-semibold text-faint"
                >
                  Ask Role Pilot
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">What's next</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ComingSoonCard
            icon={FileText}
            title="Cover Letter Assistant"
            description="Draft a cover letter grounded in your actual profile and the job's real requirements."
          />
          <ComingSoonCard
            icon={Search}
            title="Find Jobs For Me"
            description="Role Pilot proactively surfaces jobs on RoleWave that fit your profile."
          />
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-faint">
          <ArrowRight size={13} />
          Role Pilot only explains what's already true in your profile and the job post — it never invents
          qualifications or guesses at fit.
        </p>
      </section>
    </div>
  );
}