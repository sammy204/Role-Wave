import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile, slugify } from '../lib/admin';
import type { Company } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const colorOptions: Company['avatar_color'][] = ['teal', 'blue', 'amber', 'purple', 'coral'];

const avatarColorMap: Record<Company['avatar_color'], string> = {
  teal: 'bg-accent-deep',
  blue: 'bg-[#0C447C]',
  amber: 'bg-[#96690A]',
  purple: 'bg-[#5B4088]',
  coral: 'bg-[#A6432B]',
};

const emptyForm = {
  companyName: '',
  companyWebsite: '',
  companyLocation: '',
  companySize: '',
  roleTitle: '',
  phone: '',
  officeLocation: '',
  description: '',
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
}

function pickColor(value: string): Company['avatar_color'] {
  const hash = value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colorOptions[hash % colorOptions.length];
}

export default function EmployerOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          navigate('/start?role=employer', { replace: true });
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        if (nextProfile?.account_type === 'candidate') {
          navigate('/candidate', { replace: true });
          return;
        }

        const { data: employerProfile } = await supabase
          .from('employer_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!alive) return;

        if (employerProfile) {
          const existing = employerProfile as {
            company_id: string | null;
            company_name: string;
            company_website: string | null;
            company_size: string | null;
            role_title: string | null;
            phone: string | null;
            office_location: string | null;
          };

          setCompanyId(existing.company_id);
          setForm({
            companyName: existing.company_name || '',
            companyWebsite: existing.company_website || '',
            companyLocation: existing.office_location || '',
            companySize: existing.company_size || '',
            roleTitle: existing.role_title || '',
            phone: existing.phone || '',
            officeLocation: existing.office_location || '',
            description: '',
          });
        }
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load employer onboarding.');
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

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) throw new Error('Please sign in again.');

      if (!form.companyName) throw new Error('Add your company name first.');

      const companyPayload = {
        name: form.companyName,
        slug: slugify(form.companyName),
        logo_initials: initials(form.companyName) || 'CO',
        avatar_color: pickColor(form.companyName),
        owner_profile_id: session.user.id,
        location: form.companyLocation || null,
        website: form.companyWebsite || null,
        description: form.description || null,
        verified: true,
        job_count: 0,
      };

      let nextCompanyId = companyId;

      if (!nextCompanyId) {
        const { data: createdCompany, error: companyError } = await supabase
          .from('companies')
          .insert(companyPayload)
          .select('*')
          .single();
        if (companyError) throw companyError;
        nextCompanyId = createdCompany.id;
        setCompanyId(createdCompany.id);
      } else {
        const { error: updateCompanyError } = await supabase
          .from('companies')
          .update(companyPayload)
          .eq('id', nextCompanyId);
        if (updateCompanyError) throw updateCompanyError;
      }

      const { error: employerError } = await supabase.from('employer_profiles').upsert({
        id: session.user.id,
        company_id: nextCompanyId,
        company_name: form.companyName,
        company_website: form.companyWebsite || null,
        company_size: form.companySize || null,
        role_title: form.roleTitle || null,
        phone: form.phone || null,
        office_location: form.officeLocation || null,
      });
      if (employerError) throw employerError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true, account_type: 'employer' })
        .eq('id', session.user.id);
      if (profileError) throw profileError;

      navigate('/post', { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save employer details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel motion-safe:animate-fade-up rounded-[24px] px-5 py-5">
          <LoadingSpinner className="text-[#1D9E75]" />
        </div>
      </div>
    );
  }

  const previewInitials = initials(form.companyName) || 'CO';
  const previewColor = avatarColorMap[pickColor(form.companyName || 'CO')];

  return (
    <div className="page-shell px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1180px] gap-4 lg:grid-cols-[1fr_320px]">
        <div className="panel motion-safe:animate-fade-up rounded-[32px] p-5 sm:p-8">
          <Link
            to="/start?role=employer"
            className="ghost-chip !rounded-full mb-5 !px-3 !py-2 !text-[13px]"
          >
            <ArrowLeft size={14} /> Back
          </Link>

          <div className="mb-2 font-display text-2xl font-bold text-ink">Set up your company</div>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted">
            This creates your employer presence on RoleWave so you can post jobs and review applicants.
          </p>

          {error && (
            <div className="mb-4 rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <section>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
                Company identity
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company name">
                  <input className="admin-input" value={form.companyName} onChange={(e) => updateField('companyName', e.target.value)} placeholder="Paystack" />
                </Field>
                <Field label="Company website">
                  <input className="admin-input" value={form.companyWebsite} onChange={(e) => updateField('companyWebsite', e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="Company location">
                  <input className="admin-input" value={form.companyLocation} onChange={(e) => updateField('companyLocation', e.target.value)} placeholder="Lagos, Nigeria" />
                </Field>
                <Field label="Company size">
                  <input className="admin-input" value={form.companySize} onChange={(e) => updateField('companySize', e.target.value)} placeholder="11-50" />
                </Field>
              </div>
            </section>

            <section className="border-t border-line pt-6">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
                Your details
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your role">
                  <input className="admin-input" value={form.roleTitle} onChange={(e) => updateField('roleTitle', e.target.value)} placeholder="Founder / HR lead" />
                </Field>
                <Field label="Phone">
                  <input className="admin-input" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+234..." />
                </Field>
                <Field label="Office location">
                  <input className="admin-input" value={form.officeLocation} onChange={(e) => updateField('officeLocation', e.target.value)} placeholder="Victoria Island" />
                </Field>
              </div>
            </section>

            <section className="border-t border-line pt-6">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
                About the company
              </div>
              <Field label="Company description">
                <textarea className="admin-input min-h-[120px] resize-y" value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Tell candidates what your company does." />
              </Field>
            </section>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-[1px] hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save company profile'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Live identity preview: reflects exactly what gets saved to `companies` */}
          <div
            className="panel motion-safe:animate-fade-up sticky top-6 rounded-[28px] p-5"
            style={{ animationDelay: '100ms' }}
          >
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
              Preview
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white transition-colors duration-300 ${previewColor}`}
              >
                {previewInitials}
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-lg font-bold text-ink">
                  {form.companyName || 'Your company name'}
                </div>
                <div className="truncate text-sm text-muted">
                  {form.companyLocation || 'Location not set'}
                </div>
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#5DCAA5] bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
              <BadgeCheck size={12} /> Verified on save
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted">
              {form.description || 'Your company description will appear here as candidates see it.'}
            </p>
          </div>

          <div
            className="panel motion-safe:animate-fade-up rounded-[28px] p-5"
            style={{ animationDelay: '160ms' }}
          >
            <div className="text-sm font-semibold text-ink">What happens next</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Saving takes you straight to posting your first job. You can edit any of these details later from your employer dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: import('react').ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
