import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PostJob() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    jobTitle: '',
    companyName: '',
    city: '',
    workType: '',
    jobType: '',
    salary: '',
    description: '',
    requirements: '',
    howToApply: '',
    contactEmail: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const { error } = await supabase.from('job_submissions').insert({
      job_title: form.jobTitle,
      company_name: form.companyName,
      city: form.city,
      work_type: form.workType,
      job_type: form.jobType,
      salary: form.salary || null,
      description: form.description,
      requirements: form.requirements,
      how_to_apply: form.howToApply,
      contact_email: form.contactEmail,
    });

    if (!error) {
      setSubmitted(true);
    }
  };

  const isValid =
    form.jobTitle &&
    form.companyName &&
    form.city &&
    form.workType &&
    form.jobType &&
    form.description &&
    form.requirements &&
    form.howToApply &&
    form.contactEmail;

  if (submitted) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel w-full max-w-md rounded-[28px] p-8 text-center sm:p-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E1F5EE]">
            <Check size={24} className="text-[#1D9E75]" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-[#1A1A1A]">Submitted for review</h2>
          <p className="mb-6 text-sm text-[#5F5E5A]">
            Thanks! Our team will verify your listing and publish it within 24 hours.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#168a63]"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const fieldClass =
    'field-shell rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors';

  return (
    <div className="page-shell">
      <div className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 gap-4 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="panel rounded-[28px] px-4 py-6 sm:px-6 sm:py-8">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-white px-3 py-2 text-[13px] text-[#5F5E5A] transition-colors hover:text-[#1A1A1A] sm:mb-6"
          >
            <ArrowLeft size={14} /> Home
          </Link>

          <div className="mb-1.5 text-2xl font-bold text-[#1A1A1A]">Post a job</div>
          <div className="mb-6 text-sm text-[#5F5E5A]">
            Free to post. We review every listing manually and publish within 24 hours.
          </div>

          <div className="mb-6 flex items-start gap-2.5 rounded-[16px] border border-[#5DCAA5] bg-[#E1F5EE] p-4 text-[13px] font-medium leading-relaxed text-[#085041]">
            <Check size={16} className="mt-0.5 flex-shrink-0" />
            No scam jobs. No fake companies. Every listing is verified by our team before going live on RoleWave.
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Job title</label>
              <input type="text" placeholder="e.g. Product Designer" className={fieldClass} value={form.jobTitle} onChange={(e) => handleChange('jobTitle', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Company name</label>
              <input type="text" placeholder="e.g. Paystack" className={fieldClass} value={form.companyName} onChange={(e) => handleChange('companyName', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">City</label>
              <select className={fieldClass} value={form.city} onChange={(e) => handleChange('city', e.target.value)}>
                <option value="">Select city</option>
                <option>Lagos</option>
                <option>Abuja</option>
                <option>Port Harcourt</option>
                <option>Remote</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Work type</label>
              <select className={fieldClass} value={form.workType} onChange={(e) => handleChange('workType', e.target.value)}>
                <option value="">Select work type</option>
                <option>Remote</option>
                <option>Hybrid</option>
                <option>On-site</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Job type</label>
              <select className={fieldClass} value={form.jobType} onChange={(e) => handleChange('jobType', e.target.value)}>
                <option value="">Select job type</option>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Internship</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Salary (optional)</label>
              <input type="text" placeholder="e.g. ₦300,000/month" className={fieldClass} value={form.salary} onChange={(e) => handleChange('salary', e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Job description</label>
              <textarea placeholder="Describe the role, responsibilities, and what makes it a great opportunity..." rows={4} className={`${fieldClass} resize-none leading-relaxed`} value={form.description} onChange={(e) => handleChange('description', e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Requirements</label>
              <textarea placeholder="List the key skills, qualifications, and experience needed..." rows={4} className={`${fieldClass} resize-none leading-relaxed`} value={form.requirements} onChange={(e) => handleChange('requirements', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">How to apply</label>
              <input type="text" placeholder="Email address or direct application link" className={fieldClass} value={form.howToApply} onChange={(e) => handleChange('howToApply', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Your contact email</label>
              <input type="email" placeholder="For our review team only - not published" className={fieldClass} value={form.contactEmail} onChange={(e) => handleChange('contactEmail', e.target.value)} />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`mt-6 rounded-xl px-8 py-3.5 text-[15px] font-bold transition-colors ${
              isValid ? 'bg-[#1D9E75] text-white hover:bg-[#168a63]' : 'cursor-not-allowed bg-[#D3D1C7] text-[#B4B2A9]'
            }`}
          >
            Submit for review →
          </button>
        </div>

        <div className="rounded-[28px] panel-soft px-4 py-6 sm:px-6 sm:py-7">
          <div className="mb-3.5 rounded-[20px] border border-[#D3D1C7] bg-white p-4">
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#1A1A1A]">Why post on RoleWave?</h3>
            <ul className="mt-1.5">
              {['Free to post - always', 'Reach Nigerian tech talent directly', 'Verified listing builds employer trust', 'Live within 24 hours of review', 'Share across our social channels'].map((item) => (
                <li key={item} className="flex gap-1.5 py-1 text-xs text-[#5F5E5A]">
                  <Check size={12} className="mt-0.5 flex-shrink-0 font-bold text-[#1D9E75]" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-3.5 rounded-[20px] border border-[#D3D1C7] bg-white p-4">
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#1A1A1A]">Tips for a great listing</h3>
            <ul className="mt-1.5">
              {['Be specific with the job title', 'Include salary or range if possible', 'List 3-5 key requirements only', 'Make the apply process clear'].map((item) => (
                <li key={item} className="flex gap-1.5 py-1 text-xs text-[#5F5E5A]">
                  <Check size={12} className="mt-0.5 flex-shrink-0 font-bold text-[#1D9E75]" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[20px] border border-[#D3D1C7] bg-white p-4">
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#1A1A1A]">Our review process</h3>
            <p className="text-xs leading-relaxed text-[#5F5E5A]">
              Every listing is checked by our team. We verify the company exists, the contact is real, and the role is genuine. Fake or misleading listings are removed immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
