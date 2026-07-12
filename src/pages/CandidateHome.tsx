import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, MapPin, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { withTimeout } from '../lib/withTimeout';
import type { CandidateProfile, Company, Job, Profile } from '../types';
import JobCard from '../components/JobCard';

const FETCH_TIMEOUT_MS = 25000;

function scoreJob(job: Job, candidate: CandidateProfile | null) {
  if (!candidate) return 0;

  const title = job.title.toLowerCase();
  const tags = (job.tags || []).map((tag) => tag.toLowerCase());
  const description = `${job.title} ${job.location} ${(job.tags || []).join(' ')}`.toLowerCase();

  let score = 0;
  const skills = (candidate.skills || []).map((skill) => skill.toLowerCase());

  skills.forEach((skill) => {
    if (title.includes(skill) || tags.some((tag) => tag.includes(skill)) || description.includes(skill)) {
      score += 2;
    }
  });

  if (candidate.preferred_locations?.includes(job.location)) {
    score += 3;
  }

  if (candidate.work_preference && job.work_type === candidate.work_preference) {
    score += 2;
  }

  if (job.work_type === 'Remote') {
    score += 1;
  }

  return score;
}

export default function CandidateHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [jobs, setJobs] = useState<(Job & { company?: Company })[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          navigate('/start?mode=login', { replace: true });
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        if (nextProfile?.account_type !== 'candidate') {
          navigate('/', { replace: true });
          return;
        }

        setProfile(nextProfile);

        const [{ data: candidateRow }, { data: jobsData, error: jobsError }, { data: companiesData }] =
          await Promise.all([
            supabase.from('candidate_profiles').select('*').eq('id', session.user.id).maybeSingle(),
            withTimeout(
              supabase
                .from('jobs')
                .select('*')
                .eq('status', 'active')
                .order('featured', { ascending: false })
                .order('created_at', { ascending: false }),
              FETCH_TIMEOUT_MS,
              'Jobs query'
            ),
            withTimeout(supabase.from('companies').select('*'), FETCH_TIMEOUT_MS, 'Companies query'),
          ]);

        if (!alive) return;
        if (jobsError) throw jobsError;

        const companyById = new Map((companiesData || []).map((company) => [company.id, company]));
        const typedCandidate = (candidateRow || null) as CandidateProfile | null;
        const scoredJobs = (jobsData || [])
          .map((job) => ({ ...job, company: companyById.get(job.company_id) }))
          .sort((a, b) => scoreJob(b, typedCandidate) - scoreJob(a, typedCandidate));

        setCandidateProfile(typedCandidate);
        setJobs(scoredJobs);
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your home feed.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, [navigate]);

  const matchedJobs = useMemo(() => jobs.slice(0, 8), [jobs]);

  if (loading) {
    return (
      <div className="page-shell px-4 py-6 sm:px-6 lg:px-8">
        <div className="panel rounded-[24px] px-5 py-4 text-sm text-[#5F5E5A]">
          Loading your job feed...
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell px-4 py-6 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[720px] space-y-4">
        <div className="panel rounded-[28px] p-5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041]">
            <Briefcase size={12} /> For you
          </div>
          <h1 className="font-display text-2xl font-bold text-[#1A1A1A]">
            {profile?.full_name ? `Welcome, ${profile.full_name.split(/\s+/)[0]}` : 'Welcome'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
            These jobs are matched to your profile and activity.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#5F5E5A]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FBFAF7] px-3 py-1">
              <MapPin size={12} /> {candidateProfile?.preferred_locations?.length ? candidateProfile.preferred_locations.join(', ') : 'Any location'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FBFAF7] px-3 py-1">
              <Sparkles size={12} /> {candidateProfile?.work_preference || 'Any work style'}
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {matchedJobs.length === 0 ? (
            <div className="panel rounded-[24px] py-20 text-center text-[#5F5E5A]">
              No matched jobs yet.
            </div>
          ) : (
            matchedJobs.map((job) => <JobCard key={job.id} job={job} />)
          )}
        </div>
      </div>
    </div>
  );
}
