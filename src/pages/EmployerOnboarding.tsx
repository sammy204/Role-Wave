import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile, slugify } from '../lib/admin';
import type { Company } from '../types';

const colorOptions: Company['avatar_color'][] = ['teal', 'blue', 'amber', 'purple', 'coral'];

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
        <div className="panel rounded-[24px] px-5 py-4 text-sm text-[#5F5E5A]">
          Loading employer onboarding...
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1180px] gap-4 lg:grid-cols-[1fr_320px]">
        <div className="panel rounded-[32px] p-5 sm:p-8">
          <Link
            to="/start?role=employer"
            className="mb-5 inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-white px-3 py-2 text-[13px] text-[#5F5E5A]"
          >
            <ArrowLeft size={14} /> Back
          </Link>

          <div className="mb-2 text-2xl font-bold text-[#1A1A1A]">Set up your company</div>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#5F5E5A]">
            This creates your employer presence on RoleWave so you can post jobs and later discover candidates.
          </p>

          {error && (
            <div className="mb-4 rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
              {error}
            </div>
          )}

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
            <Field label="Your role">
              <input className="admin-input" value={form.roleTitle} onChange={(e) => updateField('roleTitle', e.target.value)} placeholder="Founder / HR lead" />
            </Field>
            <Field label="Phone">
              <input className="admin-input" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+234..." />
            </Field>
            <Field label="Office location">
              <input className="admin-input" value={form.officeLocation} onChange={(e) => updateField('officeLocation', e.target.value)} placeholder="Victoria Island" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Company description">
                <textarea className="admin-input min-h-[120px] resize-y" value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Tell candidates what your company does." />
              </Field>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#168a63] disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save company profile'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="panel rounded-[28px] p-5">
            <div className="text-sm font-semibold text-[#1A1A1A]">Employer flow</div>
            <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
              Once your company is set up, you can continue to post jobs and later review matching candidates.
            </p>
          </div>
          <div className="panel rounded-[28px] p-5">
            <div className="text-sm font-semibold text-[#1A1A1A]">Next milestone</div>
            <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
              We’ll turn the current job posting flow into a real employer dashboard after onboarding.
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
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
        {label}
      </span>
      {children}
    </label>
  );
}