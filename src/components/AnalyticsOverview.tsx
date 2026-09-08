import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AnalyticsEventName } from '../lib/analytics';

type AnalyticsRow = { event_name: AnalyticsEventName; created_at: string };
type ProMetrics = { active_pro_users: number };

const EVENT_LABELS: Record<AnalyticsEventName, string> = {
  page_view: 'Page views',
  job_search: 'Job searches',
  job_view: 'Job views',
  job_saved: 'Jobs saved',
  application_started: 'Applications started',
  application_submitted: 'Applications submitted',
  signup_completed: 'Signups completed',
  pwa_installed: 'PWA installs',
  passkey_enabled: 'Passkeys enabled',
  job_posted: 'Jobs posted',
  report_submitted: 'Reports submitted',
};

export default function AnalyticsOverview() {
  const [events, setEvents] = useState<AnalyticsRow[]>([]);
  const [activeProUsers, setActiveProUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    (async () => {
      const [eventsResult, proMetricsResult] = await Promise.all([
        supabase
          .from('analytics_events')
          .select('event_name, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(10000),
        supabase.rpc('admin_get_pro_metrics'),
      ]);
      if (!active) return;
      if (eventsResult.error || proMetricsResult.error) {
        setError('Analytics data is not available yet. Apply the analytics migrations first.');
      } else {
        setEvents((eventsResult.data || []) as AnalyticsRow[]);
        const metrics = (proMetricsResult.data?.[0] || null) as ProMetrics | null;
        setActiveProUsers(Number(metrics?.active_pro_users || 0));
      }
      setLoading(false);
    })();

    return () => { active = false; };
  }, []);

  const counts = useMemo(() => {
    const result = {} as Record<AnalyticsEventName, number>;
    events.forEach((event) => { result[event.event_name] = (result[event.event_name] || 0) + 1; });
    return result;
  }, [events]);

  if (loading) return <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5 text-sm text-[#5F5E5A]">Loading analytics...</div>;
  if (error) return <div className="rounded-2xl border border-[#F0D080] bg-[#FFF8E6] p-5 text-sm text-[#7A5000]">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-[#6B6960]"><BarChart3 size={15} className="text-[#1D9E75]" /> Optional analytics events from the last 30 days.</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-2xl border border-[#D3D1C7] bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[#8A867E]">Active Pro users</div>
          <div className="mt-2 text-2xl font-bold text-[#1A1A1A]">{activeProUsers}</div>
          <div className="mt-1 text-xs text-[#6B6960]">Current paid access</div>
        </div>
        {(['page_view', 'job_view', 'application_submitted', 'signup_completed', 'pwa_installed'] as AnalyticsEventName[]).map((eventName) => (
          <div key={eventName} className="rounded-2xl border border-[#D3D1C7] bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[#8A867E]">{EVENT_LABELS[eventName]}</div>
            <div className="mt-2 text-2xl font-bold text-[#1A1A1A]">{counts[eventName] || 0}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Event activity</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(EVENT_LABELS).map((key) => {
            const eventName = key as AnalyticsEventName;
            return <div key={eventName} className="flex items-center justify-between rounded-xl bg-[#FBFAF7] px-3 py-2 text-sm"><span className="text-[#5F5E5A]">{EVENT_LABELS[eventName]}</span><span className="font-semibold text-[#1A1A1A]">{counts[eventName] || 0}</span></div>;
          })}
        </div>
      </div>
    </div>
  );
}
