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
      <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8] px-4">
        <div className="bg-white rounded-xl p-8 sm:p-10 text-center max-w-md shadow-sm border border-[#D3D1C7] w-full">
          <div className="w-12 h-12 bg-[#E1F5EE] rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-[#1D9E75]" />
          </div>
          <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Submitted for review</h2>
          <p className="text-sm text-[#5F5E5A] mb-6">
            Thanks! Our team will verify your listing and publish it within 24 hours.
          </p>
          <Link
            to="/"
            className="inline-block bg-[#1D9E75] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#168a63] transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F1EFE8]">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] flex-1">
        <div className="px-4 sm:px-10 py-6 sm:py-9">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[13px] text-[#5F5E5A] hover:text-[#1A1A1A] mb-4 sm:mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Home
          </Link>

          <div className="text-xl sm:text-2xl font-bold text-[#1A1A1A] mb-1.5">Post a job</div>
          <div className="text-sm text-[#5F5E5A] mb-6 sm:mb-7">
            Free to post. We review every listing manually and publish within 24 hours.
          </div>

          <div className="flex items-start gap-2.5 bg-[#E1F5EE] rounded-[10px] p-4 mb-6 text-[13px] text-[#085041] font-medium leading-relaxed">
            <Check size={16} className="mt-0.5 flex-shrink-0" />
            No scam jobs. No fake companies. Every listing is verified by our team before going live on Career Connect.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                Job title
              </label>
              <input
                type="text"
                placeholder="e.g. Product Designer"
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75]"
                value={form.jobTitle}
                onChange={(e) => handleChange('jobTitle', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                Company name
              </label>
              <input
                type="text"
                placeholder="e.g. Paystack"
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75]"
                value={form.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                City
              </label>
              <select
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75]"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
              >
                <option value="">Select city</option>
                <option>Lagos</option>
                <option>Abuja</option>
                <option>Port Harcourt</option>
                <option>Remote</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                Work type
              </label>
              <select
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75]"
                value={form.workType}
                onChange={(e) => handleChange('workType', e.target.value)}
              >
                <option value="">Select work type</option>
                <option>Remote</option>
                <option>Hybrid</option>
                <option>On-site</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                Job type
              </label>
              <select
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75]"
                value={form.jobType}
                onChange={(e) => handleChange('jobType', e.target.value)}
              >
                <option value="">Select job type</option>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Internship</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                Salary (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. ₦300,000/month"
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75]"
                value={form.salary}
                onChange={(e) => handleChange('salary', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                Job description
              </label>
              <textarea
                placeholder="Describe the role, responsibilities, and what makes it a great opportunity..."
                rows={4}
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75] resize-none leading-relaxed"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                Requirements
              </label>
              <textarea
                placeholder="List the key skills, qualifications, and experience needed..."
                rows={4}
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75] resize-none leading-relaxed"
                value={form.requirements}
                onChange={(e) => handleChange('requirements', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                How to apply
              </label>
              <input
                type="text"
                placeholder="Email address or direct application link"
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75]"
                value={form.howToApply}
                onChange={(e) => handleChange('howToApply', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px]">
                Your contact email
              </label>
              <input
                type="email"
                placeholder="For our review team only - not published"
                className="px-3.5 py-2.5 border border-[#D3D1C7] rounded-lg text-sm text-[#1A1A1A] bg-white outline-none focus:border-[#1D9E75]"
                value={form.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`mt-6 px-8 py-3.5 rounded-[10px] text-[15px] font-bold transition-colors ${
              isValid
                ? 'bg-[#1D9E75] text-white hover:bg-[#168a63]'
                : 'bg-[#D3D1C7] text-[#B4B2A9] cursor-not-allowed'
            }`}
          >
            Submit for review →
          </button>
        </div>

        <div className="hidden lg:block border-l border-[#D3D1C7] px-6 py-7 bg-[#F1EFE8]">
          <div className="bg-white rounded-xl p-4 mb-3.5 border border-[#D3D1C7]">
            <h4 className="text-[13px] font-semibold text-[#1A1A1A] mb-1.5">Why post on NaijaJobs?</h4>
            <ul className="mt-1.5">
              {[
                'Free to post - always',
                'Reach Nigerian tech talent directly',
                'Verified listing builds employer trust',
                'Live within 24 hours of review',
                'Share across our social channels',
              ].map((item) => (
                <li key={item} className="text-xs text-[#5F5E5A] py-1 flex gap-1.5">
                  <Check size={12} className="text-[#1D9E75] font-bold mt-0.5 flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl p-4 mb-3.5 border border-[#D3D1C7]">
            <h4 className="text-[13px] font-semibold text-[#1A1A1A] mb-1.5">Tips for a great listing</h4>
            <ul className="mt-1.5">
              {[
                'Be specific with the job title',
                'Include salary or range if possible',
                'List 3-5 key requirements only',
                'Make the apply process clear',
              ].map((item) => (
                <li key={item} className="text-xs text-[#5F5E5A] py-1 flex gap-1.5">
                  <Check size={12} className="text-[#1D9E75] font-bold mt-0.5 flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#D3D1C7]">
            <h4 className="text-[13px] font-semibold text-[#1A1A1A] mb-1.5">Our review process</h4>
            <p className="text-xs text-[#5F5E5A] leading-relaxed">
              Every listing is checked by our team. We verify the company exists, the contact is real, and the role is genuine. Fake or misleading listings are removed immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
