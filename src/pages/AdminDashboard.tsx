import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleSlash2,
  ClipboardList,
  Clock3,
  ExternalLink,
  Inbox,
  LogOut,
  PlayCircle,
  PlusCircle,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { fetchProfile, slugify } from '../lib/admin';
import type { Company, Job, JobSubmission, Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import CompanyLogo from '../components/CompanyLogo';

type SubmissionTab = 'pending' | 'reviewed';
type JobTab = 'all' | 'active' | 'filled' | 'closed' | 'archived';
type AdminView = 'overview' | 'profile' | 'tasks' | 'activity' | 'submissions' | 'jobs' | 'companies' | 'users' | 'analytics' | 'newsletter' | 'team' | 'create';
type UserType = 'candidate' | 'employer' | 'unassigned';
type JobStatus = 'active' | 'filled' | 'closed' | 'archived';
type JobSortKey = 'created_at' | 'title' | 'company' | 'status';
type SortDir = 'asc' | 'desc';

const FETCH_TIMEOUT_MS = 10000;

const avatarColors: Company['avatar_color'][] = ['teal', 'blue', 'amber', 'purple', 'coral'];
const jobTabs: Array<{ key: JobTab; label: string }> = [
  { key: 'all', label: 'All jobs' },
  { key: 'active', label: 'Active' },
  { key: 'filled', label: 'Filled' },
  { key: 'closed', label: 'Closed' },
  { key: 'archived', label: 'Archived' },
];

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
  return avatarColors[hash % avatarColors.length];
}

function buildJobSlug(title: string, companyName: string) {
  return `${slugify(title)}-${slugify(companyName)}-${Math.random().toString(36).slice(2, 6)}`;
}

function formatRelative(date: string) {
  const now = new Date();
  const then = new Date(date);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diff < 86400) return 'Today';
  if (diff < 172800) return '1 day ago';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  return `${Math.floor(diff / 2592000)} months ago`;
}

function statusTone(status: string) {
  switch (status) {
    case 'active':
      return 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]';
    case 'filled':
      return 'bg-[#E6F1FB] text-[#0C447C] border-[#9AC0E8]';
    case 'closed':
      return 'bg-[#F1EFE8] text-[#5F5E5A] border-[#D3D1C7]';
    case 'archived':
      return 'bg-[#FAEEDA] text-[#633806] border-[#F0D080]';
    default:
      return 'bg-[#F1EFE8] text-[#5F5E5A] border-[#D3D1C7]';
  }
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getWelcomeName(adminProfile: AdminProfile | null, profile: Profile | null, email: string) {
  const rawName = adminProfile?.first_name?.trim() || profile?.full_name?.trim();
  const source = rawName || email.split('@')[0] || '';
  const firstPart = source
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)[0];

  if (!firstPart) {
    return 'Admin';
  }

  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
}

const emptyCreateForm = {
  jobTitle: '',
  companyName: '',
  companyWebsite: '',
  city: 'Lagos',
  workType: 'Remote',
  jobType: 'Full-time',
  salary: '',
  description: '',
  requirements: '',
  whatYoullDo: '',
  tags: '',
  status: 'active' as JobStatus,
  featured: false,
};

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_admin: boolean;
  account_type: 'candidate' | 'employer' | null;
  onboarding_completed: boolean;
  account_status: 'active' | 'deletion_scheduled' | null;
  created_at: string;
  company_name: string | null;
};

type NewsletterSend = {
  id: string;
  subject: string;
  sent_count: number | null;
  failed_count: number | null;
  created_at: string;
  status?: string | null;
};

type AdminInvite = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

type AdminProfile = {
  id: string;
  first_name: string;
  last_name: string | null;
};

type AdminTeamMember = {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  is_founder: boolean;
  created_at: string;
};

type AdminActivity = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  actor_first_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

type AdminTask = {
  id: number;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assignee_first_name: string | null;
  assignee_email: string | null;
  created_by: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const refreshTimerRef = useRef<number | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [submissions, setSubmissions] = useState<JobSubmission[]>([]);
  const [jobs, setJobs] = useState<(Job & { company?: Company })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<AdminUser[]>([]);
  const [teamMembers, setTeamMembers] = useState<AdminTeamMember[]>([]);
  const [activityLog, setActivityLog] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<AdminView>('overview');
  const [selectedUserType, setSelectedUserType] = useState<UserType>('candidate');
  const [selectedSubmissionTab, setSelectedSubmissionTab] = useState<SubmissionTab>('pending');
  const [selectedJobTab, setSelectedJobTab] = useState<JobTab>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [savingJob, setSavingJob] = useState(false);
  const [jobSort, setJobSort] = useState<{ key: JobSortKey; dir: SortDir }>({ key: 'created_at', dir: 'desc' });
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [newsletterSends, setNewsletterSends] = useState<NewsletterSend[]>([]);
  const [newsletterSubject, setNewsletterSubject] = useState('');
  const [newsletterBody, setNewsletterBody] = useState('');
  const [newsletterCtaLabel, setNewsletterCtaLabel] = useState('');
  const [newsletterCtaUrl, setNewsletterCtaUrl] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSending, setNewsletterSending] = useState(false);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<number | null>(null);
  const [deletingInviteId, setDeletingInviteId] = useState<number | null>(null);
  const [adminWelcomeSending, setAdminWelcomeSending] = useState(false);
  const [revokingAdminId, setRevokingAdminId] = useState<string | null>(null);
  const [adminProfileFirstName, setAdminProfileFirstName] = useState('');
  const [adminProfileLastName, setAdminProfileLastName] = useState('');
  const [adminProfileSaving, setAdminProfileSaving] = useState(false);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium' as TaskPriority,
    dueAt: '',
  });
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskDeletingId, setTaskDeletingId] = useState<number | null>(null);
  const [dashboardRefreshTick, setDashboardRefreshTick] = useState(0);

  useEffect(() => {
    if (!notice && !error) return;

    const timeout = window.setTimeout(() => {
      setNotice('');
      setError('');
    }, 7000);

    return () => window.clearTimeout(timeout);
  }, [notice, error]);

  useEffect(() => {
    mountedRef.current = true;

    async function loadDashboard() {
      setLoading(true);
      setNotice('');
      setError('');

      try {
        const { data: sessionData, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          FETCH_TIMEOUT_MS,
          'Session lookup'
        );
        if (sessionError) throw sessionError;

        const session = sessionData.session;
        if (!session) {
          navigate('/admin/login', { replace: true });
          return;
        }

        setAuthEmail(session.user.email || '');

        const nextProfile = await fetchProfile(session.user.id);
        if (!nextProfile?.is_admin) {
          navigate('/admin/login', { replace: true, state: { reason: 'no-access' } });
          return;
        }

        const [submissionResult, jobResult, companyResult, profileResult, adminProfileResult] = await Promise.all([
          withTimeout(
            supabase.from('job_submissions').select('*').order('created_at', { ascending: false }),
            FETCH_TIMEOUT_MS,
            'Submissions query'
          ),
          withTimeout(
            supabase.from('jobs').select('*').order('created_at', { ascending: false }),
            FETCH_TIMEOUT_MS,
            'Jobs query'
          ),
          withTimeout(
            supabase.from('companies').select('*').order('job_count', { ascending: false }),
            FETCH_TIMEOUT_MS,
            'Companies query'
          ),
          withTimeout(
            supabase.rpc('admin_list_users'),
            FETCH_TIMEOUT_MS,
            'Users query'
          ),
          withTimeout(
            supabase.from('admin_profiles').select('id, first_name, last_name').eq('id', session.user.id).maybeSingle(),
            FETCH_TIMEOUT_MS,
            'Admin profile query'
          ),
        ]);

        const teamResult = nextProfile.is_founder
          ? await withTimeout(supabase.rpc('admin_list_team_members'), FETCH_TIMEOUT_MS, 'Admin team query')
          : { data: [], error: null };
        const activityResult = nextProfile.is_founder
          ? await withTimeout(supabase.rpc('admin_list_activity', { p_limit: 100 }), FETCH_TIMEOUT_MS, 'Admin activity query')
          : { data: [], error: null };
        const taskResult = await withTimeout(supabase.rpc('admin_list_tasks'), FETCH_TIMEOUT_MS, 'Admin task query');

        if (!mountedRef.current) return;

        const submissionError = submissionResult.error as { message?: string } | null;
        const jobError = jobResult.error as { message?: string } | null;
        const companyError = companyResult.error as { message?: string } | null;
        const profileError = profileResult.error as { message?: string } | null;
        const adminProfileError = adminProfileResult.error as { message?: string } | null;
        const teamError = teamResult.error as { message?: string } | null;
        const activityError = activityResult.error as { message?: string } | null;
        const taskError = taskResult.error as { message?: string } | null;

        if (submissionError) throw new Error(submissionError.message || 'Failed to load submissions.');
        if (jobError) throw new Error(jobError.message || 'Failed to load jobs.');
        if (companyError) throw new Error(companyError.message || 'Failed to load companies.');
        if (profileError) throw new Error(profileError.message || 'Failed to load users.');
        if (adminProfileError) throw new Error(adminProfileError.message || 'Failed to load admin profile.');
        if (teamError) throw new Error(teamError.message || 'Failed to load admin team.');
        if (activityError) throw new Error(activityError.message || 'Failed to load admin activity.');
        if (taskError) throw new Error(taskError.message || 'Failed to load admin tasks.');

        const loadedCompanies = (companyResult.data || []) as Company[];
        const companyMap = new Map(loadedCompanies.map((company) => [company.id, company]));
        const loadedJobs = ((jobResult.data || []) as Job[]).map((job) => ({
          ...job,
          company: companyMap.get(job.company_id),
        }));

        setProfile(nextProfile);
        const loadedAdminProfile = adminProfileResult.data as AdminProfile | null;
        setAdminProfile(loadedAdminProfile);
        setAdminProfileFirstName(loadedAdminProfile?.first_name || '');
        setAdminProfileLastName(loadedAdminProfile?.last_name || '');
        setSubmissions((submissionResult.data || []) as JobSubmission[]);
        setJobs(loadedJobs);
        setCompanies(loadedCompanies);
        setProfiles((profileResult.data || []) as AdminUser[]);
        setTeamMembers((teamResult.data || []) as AdminTeamMember[]);
        setActivityLog((activityResult.data || []) as AdminActivity[]);
        setTasks((taskResult.data || []) as AdminTask[]);
      } catch (loadError) {
        if (!mountedRef.current) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load admin dashboard.');
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mountedRef.current = false;
    };
  }, [navigate, dashboardRefreshTick]);

  useEffect(() => {
    if (selectedView !== 'newsletter') return;

    let alive = true;
    setNewsletterLoading(true);

    void Promise.all([
      supabase.from('email_subscriptions').select('id', { count: 'exact', head: true }).is('unsubscribed_at', null),
      supabase.from('newsletter_sends').select('*').order('created_at', { ascending: false }).limit(20),
    ])
      .then(([subscriberResult, sendsResult]) => {
        if (!alive) return;
        if (subscriberResult.error) throw subscriberResult.error;
        if (sendsResult.error) throw sendsResult.error;
        setSubscriberCount(subscriberResult.count ?? 0);
        setNewsletterSends((sendsResult.data || []) as NewsletterSend[]);
      })
      .catch((loadError) => {
        if (alive) setError(loadError instanceof Error ? loadError.message : 'Could not load newsletter data.');
      })
      .finally(() => {
        if (alive) setNewsletterLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedView]);

  const loadInvites = async () => {
    setInvitesLoading(true);
    try {
      const { data, error: invitesError } = await supabase
        .from('admin_invites')
        .select('id, email, first_name, last_name, invited_by, created_at, expires_at, accepted_at, revoked_at')
        .order('created_at', { ascending: false });
      if (!mountedRef.current) return;
      if (invitesError) {
        setError(invitesError.message || 'Could not load invites.');
        return;
      }
      setInvites((data || []) as AdminInvite[]);
    } finally {
      if (mountedRef.current) setInvitesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedView !== 'team' || !profile?.is_founder) return;
    loadInvites();
  }, [selectedView, profile?.is_founder]);

  useEffect(() => {
    if (!profile?.is_admin) return;

    const channel = supabase.channel(`admin-dashboard-${profile.id}`);
    const tables = [
      'jobs',
      'companies',
      'job_submissions',
      'admin_invites',
      'admin_profiles',
      'admin_tasks',
      'admin_activity_log',
      'profiles',
    ] as const;

    const scheduleRefresh = (table: string) => {
      if (table === 'admin_invites' && profile.is_founder) {
        void loadInvites();
      }

      if (refreshTimerRef.current !== null) return;
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        setDashboardRefreshTick((current) => current + 1);
      }, 250);
    };

    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        table === 'profiles'
          ? { event: '*', schema: 'public', table, filter: 'is_admin=eq.true' }
          : { event: '*', schema: 'public', table },
        () => scheduleRefresh(table)
      );
    });

    channel.subscribe();

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.is_admin, profile?.is_founder]);

  const sendInvite = async () => {
    const email = inviteEmail.trim();
    const firstName = inviteFirstName.trim();
    const lastName = inviteLastName.trim();
    if (!email || !firstName) {
      setError('Enter the admin\'s first name and email address.');
      return;
    }

    setInviteSending(true);
    setNotice('');
    setError('');

    try {
      const { data, error: inviteError } = await supabase.functions.invoke('send-admin-invite', {
        body: { email, firstName, lastName },
      });
      if (inviteError) throw inviteError;
      if (data?.error) throw new Error(data.error);

      setNotice(`Invite sent to ${firstName}.`);
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
      loadInvites();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send invite.');
    } finally {
      setInviteSending(false);
    }
  };

  const revokeInvite = async (invite: AdminInvite) => {
    const confirmed = window.confirm(`Revoke the pending invite for ${invite.email}?`);
    if (!confirmed) return;

    setRevokingInviteId(invite.id);
    setNotice('');
    setError('');

    try {
      const { error: revokeError } = await supabase.rpc('revoke_admin_invite', { p_invite_id: invite.id });
      if (revokeError) throw revokeError;
      setNotice(`Invite for ${invite.email} revoked.`);
      loadInvites();
    } catch (revokeErr) {
      setError(revokeErr instanceof Error ? revokeErr.message : 'Could not revoke invite.');
    } finally {
      setRevokingInviteId(null);
    }
  };

  const deleteRevokedInvite = async (invite: AdminInvite) => {
    const confirmed = window.confirm(`Delete the revoked invite for ${invite.email}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingInviteId(invite.id);
    setNotice('');
    setError('');

    try {
      const { error: deleteError } = await supabase.rpc('delete_revoked_admin_invite', { p_invite_id: invite.id });
      if (deleteError) throw deleteError;
      setInvites((current) => current.filter((item) => item.id !== invite.id));
      setNotice(`Revoked invite for ${invite.email} deleted.`);
    } catch (deleteErr) {
      setError(deleteErr instanceof Error ? deleteErr.message : 'Could not delete invite.');
    } finally {
      setDeletingInviteId(null);
    }
  };

  const revokeAdminAccess = async (admin: AdminTeamMember) => {
    const confirmed = window.confirm(
      `Remove ${admin.first_name}'s admin access? They will no longer be able to use the admin dashboard. Their candidate or employer account, if any, will not be deleted.`
    );
    if (!confirmed) return;

    setRevokingAdminId(admin.id);
    setNotice('');
    setError('');

    try {
      const { error: revokeError } = await supabase.rpc('revoke_admin_access', { p_user_id: admin.id });
      if (revokeError) throw revokeError;

      setTeamMembers((current) => current.filter((member) => member.id !== admin.id));
      setProfiles((current) => current.map((user) => user.id === admin.id ? { ...user, is_admin: false } : user));
      setNotice(`${admin.first_name}'s admin access has been removed.`);
    } catch (revokeErr) {
      setError(revokeErr instanceof Error ? revokeErr.message : 'Could not remove admin access.');
    } finally {
      setRevokingAdminId(null);
    }
  };

  const saveAdminProfile = async () => {
    const firstName = adminProfileFirstName.trim();
    const lastName = adminProfileLastName.trim();
    if (!firstName) {
      setError('Enter your first name.');
      return;
    }

    setAdminProfileSaving(true);
    setNotice('');
    setError('');
    try {
      const { data, error: saveError } = await supabase
        .from('admin_profiles')
        .update({ first_name: firstName, last_name: lastName || null, updated_at: new Date().toISOString() })
        .eq('id', profile?.id || '')
        .select('id, first_name, last_name')
        .single();
      if (saveError) throw saveError;
      setAdminProfile(data as AdminProfile);
      setNotice('Admin profile updated.');
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Could not update admin profile.');
    } finally {
      setAdminProfileSaving(false);
    }
  };

  const createAdminTask = async () => {
    const title = taskForm.title.trim();
    if (!title) {
      setError('Enter a task title.');
      return;
    }

    setTaskSaving(true);
    setNotice('');
    setError('');
    try {
      const { data, error: taskError } = await supabase.rpc('admin_create_task', {
        p_title: title,
        p_description: taskForm.description.trim() || null,
        p_assigned_to: taskForm.assignedTo || null,
        p_priority: taskForm.priority,
        p_due_at: taskForm.dueAt || null,
      });
      if (taskError) throw taskError;

      setTasks((current) => [...current, data as AdminTask]);
      setTaskForm({ title: '', description: '', assignedTo: '', priority: 'medium', dueAt: '' });
      setNotice('Task assigned.');
    } catch (taskErr) {
      setError(taskErr instanceof Error ? taskErr.message : 'Could not create task.');
    } finally {
      setTaskSaving(false);
    }
  };

  const updateTaskStatus = async (task: AdminTask, status: TaskStatus) => {
    try {
      const { data, error: taskError } = await supabase.rpc('admin_update_task_status', {
        p_task_id: task.id,
        p_status: status,
      });
      if (taskError) throw taskError;
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...(data as AdminTask) } : item));
      setNotice('Task status updated.');
    } catch (taskErr) {
      setError(taskErr instanceof Error ? taskErr.message : 'Could not update task status.');
    }
  };

  const reassignTask = async (task: AdminTask, assignedTo: string) => {
    if (!profile?.is_founder) return;
    try {
      const { data, error: taskError } = await supabase.rpc('admin_update_task', {
        p_task_id: task.id,
        p_title: task.title,
        p_description: task.description,
        p_assigned_to: assignedTo || null,
        p_priority: task.priority,
        p_due_at: task.due_at,
        p_status: task.status,
      });
      if (taskError) throw taskError;
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...(data as AdminTask) } : item));
      setNotice('Task assignment updated.');
    } catch (taskErr) {
      setError(taskErr instanceof Error ? taskErr.message : 'Could not reassign task.');
    }
  };

  const deleteAdminTask = async (task: AdminTask) => {
    if (!window.confirm(`Delete the task "${task.title}"?`)) return;
    setTaskDeletingId(task.id);
    setNotice('');
    setError('');
    try {
      const { error: taskError } = await supabase.rpc('admin_delete_task', { p_task_id: task.id });
      if (taskError) throw taskError;
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setNotice('Task deleted.');
    } catch (taskErr) {
      setError(taskErr instanceof Error ? taskErr.message : 'Could not delete task.');
    } finally {
      setTaskDeletingId(null);
    }
  };

  const sendAdminWelcomeToAll = async () => {
    const confirmed = window.confirm(`Resend the admin welcome email to all ${adminRoster.length} current admins?`);
    if (!confirmed) return;

    setAdminWelcomeSending(true);
    setNotice('');
    setError('');

    try {
      const { data, error: sendError } = await supabase.functions.invoke('send-admin-welcome', {
        body: { mode: 'all', force: true },
      });
      if (sendError) throw sendError;
      if (data?.error) throw new Error(data.error);

      const sent = typeof data?.sent === 'number' ? data.sent : 0;
      setNotice(`Admin welcome email sent to ${sent} admin${sent === 1 ? '' : 's'}.`);
    } catch (sendErr) {
      setError(sendErr instanceof Error ? sendErr.message : 'Could not send admin welcome emails.');
    } finally {
      setAdminWelcomeSending(false);
    }
  };

  const sendNewsletter = async () => {
    if (!newsletterSubject.trim() || !newsletterBody.trim()) {
      setError('Add a subject and message before sending.');
      return;
    }

    const confirmed = window.confirm(
      `Send this newsletter to ${subscriberCount ?? 'all'} active subscribers? This action cannot be undone.`
    );
    if (!confirmed) return;

    setNewsletterSending(true);
    setNotice('');
    setError('');

    try {
      const { error: sendError } = await supabase.functions.invoke('send-newsletter', {
        body: {
          subject: newsletterSubject.trim(),
          body: newsletterBody.trim(),
          ctaText: newsletterCtaLabel.trim() || null,
          ctaUrl: newsletterCtaUrl.trim() || null,
        },
      });
      if (sendError) throw sendError;
      setNotice('Newsletter send started. Refresh the history shortly to see the result.');
      setNewsletterSubject('');
      setNewsletterBody('');
      setNewsletterCtaLabel('');
      setNewsletterCtaUrl('');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send newsletter.');
    } finally {
      setNewsletterSending(false);
    }
  };

  const companyMap = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const adminRoster = useMemo(() => teamMembers, [teamMembers]);

  const counts = useMemo(
    () => ({
      pendingSubmissions: submissions.filter((item) => item.status === 'pending').length,
      reviewedSubmissions: submissions.filter((item) => item.status !== 'pending').length,
      activeJobs: jobs.filter((item) => item.status === 'active').length,
      filledJobs: jobs.filter((item) => item.status === 'filled').length,
      closedJobs: jobs.filter((item) => item.status === 'closed').length,
      archivedJobs: jobs.filter((item) => item.status === 'archived').length,
      companies: companies.length,
      totalUsers: profiles.length,
      candidateUsers: profiles.filter((item) => item.account_type === 'candidate').length,
      employerUsers: profiles.filter((item) => item.account_type === 'employer').length,
      unassignedUsers: profiles.filter((item) => !item.account_type).length,
      scheduledDeletions: profiles.filter((item) => item.account_status === 'deletion_scheduled').length,
    }),
    [submissions, jobs, companies, profiles]
  );

  const filteredSubmissions = useMemo(() => {
    let result =
      selectedSubmissionTab === 'pending'
        ? submissions.filter((item) => item.status === 'pending')
        : submissions.filter((item) => item.status !== 'pending');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.job_title.toLowerCase().includes(q) ||
          item.company_name.toLowerCase().includes(q) ||
          item.city.toLowerCase().includes(q)
      );
    }

    return result;
  }, [searchQuery, selectedSubmissionTab, submissions]);

  const filteredJobs = useMemo(() => {
    let result =
      selectedJobTab === 'all' ? jobs : jobs.filter((item) => item.status === selectedJobTab);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.company?.name.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q)
      );
    }

    const dir = jobSort.dir === 'asc' ? 1 : -1;
    const sorted = [...result].sort((a, b) => {
      switch (jobSort.key) {
        case 'title':
          return a.title.localeCompare(b.title) * dir;
        case 'company':
          return (a.company?.name || '').localeCompare(b.company?.name || '') * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'created_at':
        default:
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
    });

    return sorted;
  }, [searchQuery, selectedJobTab, jobs, jobSort]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter((item) => item.name.toLowerCase().includes(q));
  }, [searchQuery, companies]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return profiles.filter((item) =>
      (selectedUserType === 'unassigned' ? !item.account_type : item.account_type === selectedUserType) &&
      (!q || (item.full_name || '').toLowerCase().includes(q) || (item.email || '').toLowerCase().includes(q) || (item.company_name || '').toLowerCase().includes(q))
    );
  }, [searchQuery, profiles, selectedUserType]);

  const selectedSubmissionSummary = useMemo(
    () => ({
      pending: submissions.filter((item) => item.status === 'pending').length,
      reviewed: submissions.filter((item) => item.status !== 'pending').length,
    }),
    [submissions]
  );

  const pendingQueue = useMemo(
    () =>
      submissions
        .filter((item) => item.status === 'pending')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4),
    [submissions]
  );

  const overviewData = useMemo(() => {
    const now = Date.now();
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const weekIndex = (iso: string) => Math.floor((now - new Date(iso).getTime()) / WEEK_MS);

    const inWeek = (iso: string, index: number) => weekIndex(iso) === index;
    const countInWeek = <T,>(items: T[], getDate: (item: T) => string, index: number) =>
      items.filter((item) => inWeek(getDate(item), index)).length;

    const WEEKS = 8;
    const weeklyJobs = Array.from({ length: WEEKS }, (_, i) => {
      const index = WEEKS - 1 - i;
      return { index, count: countInWeek(jobs, (j) => j.created_at, index) };
    });
    const maxWeeklyJobs = Math.max(1, ...weeklyJobs.map((w) => w.count));

    const jobsThisWeek = countInWeek(jobs, (j) => j.created_at, 0);
    const jobsLastWeek = countInWeek(jobs, (j) => j.created_at, 1);
    const submissionsThisWeek = countInWeek(submissions, (s) => s.created_at, 0);
    const submissionsLastWeek = countInWeek(submissions, (s) => s.created_at, 1);
    const companiesThisWeek = countInWeek(companies, (c) => c.created_at, 0);
    const companiesLastWeek = countInWeek(companies, (c) => c.created_at, 1);

    const delta = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const funnel = [
      { label: 'Pending', count: submissions.filter((s) => s.status === 'pending').length, tone: 'bg-[#D9A441]' },
      { label: 'Approved', count: submissions.filter((s) => s.status === 'approved').length, tone: 'bg-accent' },
      { label: 'Rejected', count: submissions.filter((s) => s.status === 'rejected').length, tone: 'bg-[#C4634A]' },
    ];
    const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

    type ActivityItem = { id: string; label: string; sub: string; created_at: string; kind: 'job' | 'submission' | 'company' };
    const activity: ActivityItem[] = [
      ...jobs.map((j) => ({
        id: `job-${j.id}`,
        label: j.title,
        sub: `Job posted - ${companyMap.get(j.company_id)?.name || 'Unknown company'}`,
        created_at: j.created_at,
        kind: 'job' as const,
      })),
      ...submissions.map((s) => ({
        id: `sub-${s.id}`,
        label: s.job_title,
        sub: `Submission from ${s.company_name}`,
        created_at: s.created_at,
        kind: 'submission' as const,
      })),
      ...companies.map((c) => ({
        id: `co-${c.id}`,
        label: c.name,
        sub: 'Company added',
        created_at: c.created_at,
        kind: 'company' as const,
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);

    return {
      weeklyJobs,
      maxWeeklyJobs,
      jobsThisWeek,
      jobsDelta: delta(jobsThisWeek, jobsLastWeek),
      submissionsThisWeek,
      submissionsDelta: delta(submissionsThisWeek, submissionsLastWeek),
      companiesThisWeek,
      companiesDelta: delta(companiesThisWeek, companiesLastWeek),
      funnel,
      maxFunnel,
      activity,
    };
  }, [jobs, submissions, companies, companyMap]);

  const updateCompanyCount = (companyId: string, delta: number) => {
    setCompanies((prev) =>
      prev.map((company) =>
        company.id === companyId ? { ...company, job_count: Math.max(0, company.job_count + delta) } : company
      )
    );
  };

  const upsertJobInState = (job: Job & { company?: Company }) => {
    setJobs((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === job.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = job;
        return next;
      }
      return [job, ...prev];
    });
  };

  const removeJobFromState = (jobId: string) => {
    setJobs((prev) => prev.filter((item) => item.id !== jobId));
  };

  const setSubmissionStatusInState = (submissionId: string, status: JobSubmission['status']) => {
    setSubmissions((prev) =>
      prev.map((item) => (item.id === submissionId ? { ...item, status } : item))
    );
  };

  const removeSubmissionFromState = (submissionId: string) => {
    setSubmissions((prev) => prev.filter((item) => item.id !== submissionId));
  };

  const ensureCompany = async (companyName: string, website?: string) => {
    const companySlug = slugify(companyName);
    const existingCompany = companies.find((company) => company.slug === companySlug);

    if (existingCompany) {
      if (website && !existingCompany.website) {
        const { error } = await supabase.from('companies').update({ website }).eq('id', existingCompany.id);
        if (error) throw error;
      }
      return existingCompany;
    }

    const { data, error } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        slug: companySlug,
        logo_initials: initials(companyName) || 'CO',
        avatar_color: pickColor(companyName),
        location: null,
        website: website || null,
        description: null,
        verified: true,
        job_count: 0,
      })
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Could not create company.');

    const createdCompany = data as Company;
    setCompanies((prev) => [createdCompany, ...prev]);
    return createdCompany;
  };

  const createJob = async () => {
    setSavingJob(true);
    setNotice('');
    setError('');

    try {
      if (!createForm.jobTitle || !createForm.companyName || !createForm.description || !createForm.requirements) {
        throw new Error('Please fill in the required job fields.');
      }

      const company = await ensureCompany(createForm.companyName, createForm.companyWebsite);
      const jobSlug = buildJobSlug(createForm.jobTitle, createForm.companyName);
      const tags = createForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          title: createForm.jobTitle,
          slug: jobSlug,
          company_id: company.id,
          description: createForm.description,
          requirements: createForm.requirements,
          what_youll_do: createForm.whatYoullDo || null,
          location: createForm.city,
          work_type: createForm.workType,
          job_type: createForm.jobType,
          salary: createForm.salary || null,
          tags,
          featured: createForm.featured,
          status: createForm.status,
        })
        .select('*')
        .single();

      if (error || !data) throw error || new Error('Could not create job.');

      const createdJob = { ...(data as Job), company };
      upsertJobInState(createdJob);
      if (createForm.status === 'active') {
        updateCompanyCount(company.id, 1);
      }

      setCreateForm(emptyCreateForm);
      setSelectedView('jobs');
      setNotice(`Created "${createForm.jobTitle}" for ${createForm.companyName}.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create job.');
    } finally {
      setSavingJob(false);
    }
  };

  const handleApproveSubmission = async (submissionId: string) => {
    setProcessingId(submissionId);
    setNotice('');
    setError('');

    const submission = submissions.find((item) => item.id === submissionId);
    if (!submission) {
      setProcessingId(null);
      return;
    }

    try {
      const company = await ensureCompany(submission.company_name);
      const jobSlug = buildJobSlug(submission.job_title, submission.company_name);

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          title: submission.job_title,
          slug: jobSlug,
          company_id: company.id,
          description: submission.description,
          requirements: submission.requirements,
          what_youll_do: null,
          location: submission.city,
          work_type: submission.work_type,
          job_type: submission.job_type,
          salary: submission.salary || null,
          tags: [],
          featured: false,
          status: 'active',
        })
        .select('*')
        .single();

      if (jobError || !jobData) throw jobError || new Error('Could not publish job.');

      upsertJobInState({ ...(jobData as Job), company });
      updateCompanyCount(company.id, 1);
      setSubmissionStatusInState(submissionId, 'approved');
      setNotice(`Published "${submission.job_title}" to live jobs.`);
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Failed to approve submission.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmission = async (submissionId: string) => {
    setProcessingId(submissionId);
    setNotice('');
    setError('');

    try {
      const { error } = await supabase.from('job_submissions').update({ status: 'rejected' }).eq('id', submissionId);
      if (error) throw error;
      setSubmissionStatusInState(submissionId, 'rejected');
      setNotice('Submission rejected.');
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Failed to reject submission.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveReviewedSubmission = async (submissionId: string) => {
    const submission = submissions.find((item) => item.id === submissionId);
    if (!submission || submission.status === 'pending') return;

    const confirmed = window.confirm(
      `Remove the reviewed record for "${submission.job_title}"? This will not delete any live job.`
    );
    if (!confirmed) return;

    setProcessingId(submissionId);
    setNotice('');
    setError('');

    try {
      const { error } = await supabase
        .from('job_submissions')
        .delete()
        .eq('id', submissionId)
        .neq('status', 'pending');
      if (error) throw error;
      removeSubmissionFromState(submissionId);
      setNotice('Reviewed submission removed.');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove reviewed submission.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleJobStatus = async (jobId: string, nextStatus: JobStatus) => {
    setProcessingId(jobId);
    setNotice('');
    setError('');

    const target = jobs.find((item) => item.id === jobId);
    if (!target) {
      setProcessingId(null);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('admin_update_job_status', {
        p_job_id: jobId,
        p_status: nextStatus,
      });
      if (error) throw error;

      const updatedJob = data as Job | null;
      const prevStatus = target.status as JobStatus;
      const companyId = target.company_id;

      upsertJobInState({ ...(updatedJob || target), company: target.company });

      if (prevStatus === 'active' && nextStatus !== 'active') {
        updateCompanyCount(companyId, -1);
      } else if (prevStatus !== 'active' && nextStatus === 'active') {
        updateCompanyCount(companyId, 1);
      }

      setNotice(`Marked "${target.title}" as ${formatStatus(nextStatus).toLowerCase()}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update job status.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleVerified = async (companyId: string, nextVerified: boolean) => {
    setProcessingId(companyId);
    setNotice('');
    setError('');

    const target = companies.find((item) => item.id === companyId);
    if (!target) {
      setProcessingId(null);
      return;
    }

    try {
      const { error } = await supabase.from('companies').update({ verified: nextVerified }).eq('id', companyId);
      if (error) throw error;

      setCompanies((prev) =>
        prev.map((item) => (item.id === companyId ? { ...item, verified: nextVerified } : item))
      );
      setNotice(`${target.name} is now ${nextVerified ? 'verified' : 'unverified'}.`);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Failed to update verification status.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setProcessingId(jobId);
    setNotice('');
    setError('');

    const target = jobs.find((item) => item.id === jobId);
    if (!target) {
      setProcessingId(null);
      return;
    }

    const shouldDelete = window.confirm(`Delete "${target.title}"? This cannot be undone.`);
    if (!shouldDelete) {
      setProcessingId(null);
      return;
    }

    try {
      const { error } = await supabase.rpc('admin_delete_job', { p_job_id: jobId });
      if (error) throw error;

      if (target.status === 'active') {
        updateCompanyCount(target.company_id, -1);
      }
      removeJobFromState(jobId);
      setNotice(`Deleted "${target.title}".`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete job.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    navigate('/admin/login', { replace: true });
  };

  const toggleJobSort = (key: JobSortKey) => {
    setJobSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const toggleJobSelected = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleAllJobsSelected = () => {
    setSelectedJobIds((prev) =>
      prev.size === filteredJobs.length ? new Set() : new Set(filteredJobs.map((j) => j.id))
    );
  };

  const bulkUpdateJobStatus = async (nextStatus: JobStatus) => {
    if (selectedJobIds.size === 0) return;
    setBulkProcessing(true);
    setNotice('');
    setError('');

    const ids = Array.from(selectedJobIds);
    let succeeded = 0;

    for (const jobId of ids) {
      const target = jobs.find((item) => item.id === jobId);
      if (!target) continue;
      try {
        const { data, error: rpcError } = await supabase.rpc('admin_update_job_status', {
          p_job_id: jobId,
          p_status: nextStatus,
        });
        if (rpcError) throw rpcError;

        const updatedJob = data as Job | null;
        const prevStatus = target.status as JobStatus;
        upsertJobInState({ ...(updatedJob || target), company: target.company });

        if (prevStatus === 'active' && nextStatus !== 'active') {
          updateCompanyCount(target.company_id, -1);
        } else if (prevStatus !== 'active' && nextStatus === 'active') {
          updateCompanyCount(target.company_id, 1);
        }
        succeeded += 1;
      } catch (bulkError) {
        setError(bulkError instanceof Error ? bulkError.message : 'Some jobs could not be updated.');
      }
    }

    setSelectedJobIds(new Set());
    setBulkProcessing(false);
    if (succeeded > 0) {
      setNotice(`Marked ${succeeded} job${succeeded === 1 ? '' : 's'} as ${formatStatus(nextStatus).toLowerCase()}.`);
    }
  };

  const updateCreateField = (field: keyof typeof createForm, value: string | boolean) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8]">
        <LoadingSpinner className="text-[#1D9E75]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        <div className="mb-6 flex flex-col gap-5 rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.05)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between sm:p-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E1F5EE] text-[#085041] text-xs font-semibold mb-3">
              <BadgeCheck size={12} /> Admin dashboard
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-[-0.02em]">
              Welcome, {getWelcomeName(adminProfile, profile, authEmail)}.
            </h1>
            <p className="text-sm sm:text-base text-[#5F5E5A] mt-2 max-w-xl leading-relaxed">
              Review submissions, publish jobs, and keep the board running smoothly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedView('create')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-semibold hover:bg-[#168a63] transition-colors"
            >
              <PlusCircle size={14} /> Create job
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D3D1C7] bg-white text-sm text-[#1A1A1A]"
            >
              Public site
            </Link>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1A1A] text-white text-sm font-semibold"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        {(notice || error) && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              error
                ? 'border-[#F0D080] bg-[#FFF8E6] text-[#7A5000]'
                : 'border-[#D3D1C7] bg-white text-[#5F5E5A]'
            }`}
          >
            {error || notice}
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#F0D080] bg-[#FFF8E6] p-4 shadow-[0_10px_24px_rgba(217,164,65,0.08)]">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <Clock3 size={12} /> Pending
            </div>
            <div className="text-3xl font-bold tracking-[-0.04em] text-[#633806]">{counts.pendingSubmissions}</div>
          </div>
          <div className="rounded-2xl border border-[#5DCAA5] bg-[#E1F5EE] p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <Briefcase size={12} /> Active jobs
            </div>
            <div className="text-3xl font-bold tracking-[-0.04em] text-[#085041]">{counts.activeJobs}</div>
          </div>
          <div className="rounded-2xl border border-[#D3D1C7] bg-white p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <Building2 size={12} /> Companies
            </div>
            <div className="text-3xl font-bold tracking-[-0.04em] text-[#1A1A1A]">{counts.companies}</div>
          </div>
          <div className="rounded-2xl border border-[#D3D1C7] bg-white p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <BadgeCheck size={12} /> Reviewed
            </div>
            <div className="text-3xl font-bold tracking-[-0.04em] text-[#1A1A1A]">{selectedSubmissionSummary.reviewed}</div>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/60 p-2 backdrop-blur-xl sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1">
          {(
            [
              'overview',
              'profile',
              'tasks',
              ...(profile?.is_founder ? (['activity'] as AdminView[]) : []),
              'submissions',
              'jobs',
              'companies',
              'users',
              'analytics',
              'newsletter',
              ...(profile?.is_founder ? (['team'] as AdminView[]) : []),
              'create',
            ] as AdminView[]
          ).map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                selectedView === view
                  ? 'bg-[#1D9E75] text-white shadow-[0_6px_16px_rgba(29,158,117,0.2)]'
                  : 'text-[#6B6960] hover:bg-white hover:text-[#1A1A1A]'
              }`}
            >
              {view === 'overview'
                ? 'Overview'
                : view === 'profile'
                ? 'My profile'
                : view === 'activity'
                ? 'Activity'
                : view === 'tasks'
                ? 'Tasks'
                : view === 'submissions'
                ? 'Moderation'
                : view === 'jobs'
                ? 'Jobs'
                : view === 'companies'
                ? 'Companies'
                : view === 'users'
                ? 'Users'
                : view === 'analytics'
                ? 'Analytics'
                : view === 'newsletter'
                ? 'Newsletter'
                : view === 'team'
                ? 'Team'
                : 'Create job'}
            </button>
          ))}
          </div>
          <div className="flex-1 min-w-[120px]" />
          <div className="relative w-full sm:w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B2A9]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs or submissions"
              className="w-full rounded-full border border-[#D3D1C7] bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-[#1D9E75]"
            />
          </div>
        </div>

        {selectedView === 'profile' && (
          <div className="max-w-xl rounded-2xl border border-[#D3D1C7] bg-white p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#1D9E75]">Admin workspace</p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#1A1A1A]">Your admin profile</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">First name</label>
                <input value={adminProfileFirstName} onChange={(event) => setAdminProfileFirstName(event.target.value)} className="admin-input" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Last name</label>
                <input value={adminProfileLastName} onChange={(event) => setAdminProfileLastName(event.target.value)} className="admin-input" />
              </div>
            </div>
            <button
              type="button"
              onClick={saveAdminProfile}
              disabled={adminProfileSaving}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adminProfileSaving ? 'Saving...' : 'Save admin profile'}
            </button>
          </div>
        )}

        {selectedView === 'tasks' && (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#1D9E75]">Admin workspace</p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#1A1A1A]">Admin tasks</h2>
              <p className="mt-2 text-sm text-[#6B6960]">
                {profile?.is_founder ? 'Assign and follow up on work across the admin team.' : 'Track the admin work assigned to you.'}
              </p>
            </div>

            {profile?.is_founder && (
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <ClipboardList size={17} className="text-[#1D9E75]" />
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Create a task</h3>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_1.3fr_0.8fr_0.7fr_0.8fr_auto] lg:items-end">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Task</label>
                    <input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Review new employer submissions" className="admin-input" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Details</label>
                    <input value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional note" className="admin-input" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Assign to</label>
                    <select value={taskForm.assignedTo} onChange={(event) => setTaskForm((current) => ({ ...current, assignedTo: event.target.value }))} className="admin-input">
                      <option value="">Unassigned</option>
                      {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.first_name}{member.is_founder ? ' (Founder)' : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Priority</label>
                    <select value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))} className="admin-input">
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Due date</label>
                    <input type="date" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} className="admin-input" />
                  </div>
                  <button type="button" onClick={createAdminTask} disabled={taskSaving} className="inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60">
                    {taskSaving ? 'Adding...' : 'Add task'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-[#D3D1C7] bg-white p-6 text-sm text-[#8A867E]">No tasks yet.</div>
              ) : tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[#1A1A1A]">{task.title}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${task.priority === 'high' ? 'border-[#E8A98C] bg-[#FFF6F1] text-[#712B13]' : task.priority === 'low' ? 'border-[#D3D1C7] bg-[#F1EFE8] text-[#6B6960]' : 'border-[#F0D080] bg-[#FFF8E6] text-[#7A5000]'}`}>{task.priority}</span>
                      </div>
                      {task.description && <p className="mt-2 text-sm leading-6 text-[#6B6960]">{task.description}</p>}
                      <p className="mt-2 text-xs text-[#8A867E]">
                        {task.assignee_first_name ? `Assigned to ${task.assignee_first_name}` : 'Unassigned'}
                        {task.due_at ? ` · due ${formatRelative(task.due_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={task.status} onChange={(event) => updateTaskStatus(task, event.target.value as TaskStatus)} className="rounded-lg border border-[#D3D1C7] bg-white px-3 py-2 text-xs font-semibold text-[#1A1A1A]">
                        <option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
                      </select>
                      {profile?.is_founder && (
                        <>
                          <select value={task.assigned_to || ''} onChange={(event) => reassignTask(task, event.target.value)} className="rounded-lg border border-[#D3D1C7] bg-white px-3 py-2 text-xs text-[#1A1A1A]">
                            <option value="">Unassigned</option>
                            {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.first_name}</option>)}
                          </select>
                          <button type="button" onClick={() => deleteAdminTask(task)} disabled={taskDeletingId === task.id} className="rounded-lg border border-[#E8A98C] bg-white px-3 py-2 text-xs font-semibold text-[#712B13] hover:bg-[#FFF6F1] disabled:opacity-60">
                            {taskDeletingId === task.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedView === 'activity' && profile?.is_founder && (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#1D9E75]">Founder-only</p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#1A1A1A]">Admin activity</h2>
              <p className="mt-2 text-sm text-[#6B6960]">A record of administrative actions across the platform.</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#D3D1C7] bg-white">
              {activityLog.length === 0 ? (
                <p className="p-6 text-sm text-[#8A867E]">No admin activity recorded yet.</p>
              ) : (
                <div className="divide-y divide-[#E5E1D8]">
                  {activityLog.map((activity) => (
                    <div key={activity.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1A1A1A]">{activity.summary}</p>
                        <p className="mt-1 text-xs text-[#8A867E]">
                          {activity.actor_first_name || activity.actor_email || 'Admin'}
                          {' · '}
                          {activity.action.replace(/[._]/g, ' ')}
                        </p>
                      </div>
                      <time className="flex-shrink-0 text-xs text-[#8A867E]" dateTime={activity.created_at}>
                        {formatRelative(activity.created_at)}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedView === 'overview' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TrendCard label="Jobs posted this week" value={overviewData.jobsThisWeek} delta={overviewData.jobsDelta} icon={Briefcase} />
              <TrendCard
                label="Submissions this week"
                value={overviewData.submissionsThisWeek}
                delta={overviewData.submissionsDelta}
                icon={Inbox}
              />
              <TrendCard
                label="Companies added this week"
                value={overviewData.companiesThisWeek}
                delta={overviewData.companiesDelta}
                icon={Building2}
              />
            </div>

            <div className="rounded-2xl border border-[#D9A441] bg-[#FFF8E6] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#7A5000]">
                    <Clock3 size={13} /> Review queue
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-[#1A1A1A]">
                    {counts.pendingSubmissions === 0
                      ? 'Everything is reviewed.'
                      : `${counts.pendingSubmissions} submission${counts.pendingSubmissions === 1 ? '' : 's'} need review`}
                  </h3>
                  <p className="mt-1 text-sm text-[#7A5000]">
                    Approve genuine roles to publish them or reject submissions that do not meet RoleWave standards.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedSubmissionTab('pending');
                    setSelectedView('submissions');
                  }}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#D9A441] bg-white px-3 py-2 text-xs font-semibold text-[#633806] hover:bg-[#FAEEDA]"
                >
                  Open full queue <ExternalLink size={13} />
                </button>
              </div>

              {pendingQueue.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {pendingQueue.map((submission) => (
                    <div key={submission.id} className="flex flex-col gap-3 rounded-xl border border-[#F0D080] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#1A1A1A]">{submission.job_title}</div>
                        <div className="mt-0.5 truncate text-xs text-[#8A867E]">
                          {submission.company_name} · {submission.city} · {formatRelative(submission.created_at)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => handleApproveSubmission(submission.id)}
                          disabled={processingId === submission.id}
                          className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#1D9E75] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          <CheckCircle2 size={13} /> Approve
                        </button>
                        <button
                          onClick={() => handleRejectSubmission(submission.id)}
                          disabled={processingId === submission.id}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#D3D1C7] bg-white px-3 py-2 text-xs font-semibold text-[#5F5E5A] disabled:opacity-60"
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Jobs posted, last 8 weeks</h3>
                  <div className="flex items-end gap-2 h-32">
                    {overviewData.weeklyJobs.map((week) => (
                      <div key={week.index} className="flex-1 flex flex-col items-center gap-1.5">
                        <div className="w-full flex items-end justify-center h-24">
                          <div
                            className="w-full max-w-[28px] rounded-t-md bg-[#1D9E75] transition-all"
                            style={{
                              height: `${Math.max(4, (week.count / overviewData.maxWeeklyJobs) * 100)}%`,
                            }}
                            title={`${week.count} job${week.count === 1 ? '' : 's'}`}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-[#8A867E] tabular-nums">{week.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.5px] text-[#B4B2A9]">
                    <span>8 weeks ago</span>
                    <span>This week</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Recent activity</h3>
                  <div className="space-y-3">
                    {overviewData.activity.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <div
                          className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                            item.kind === 'job' ? 'bg-[#1D9E75]' : item.kind === 'submission' ? 'bg-[#D9A441]' : 'bg-[#0C447C]'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#1A1A1A] truncate">{item.label}</div>
                          <div className="text-xs text-[#8A867E]">
                            {item.sub} - {formatRelative(item.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {overviewData.activity.length === 0 && (
                      <div className="text-sm text-[#8A867E]">No activity yet.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Submission funnel</h3>
                <div className="space-y-3">
                  {overviewData.funnel.map((stage) => (
                    <div key={stage.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-[#5F5E5A]">{stage.label}</span>
                        <span className="font-semibold text-[#1A1A1A] tabular-nums">{stage.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F1EFE8] overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${stage.tone}`}
                          style={{ width: `${Math.max(4, (stage.count / overviewData.maxFunnel) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedView === 'users' && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TrendCard label="Total accounts" value={counts.totalUsers} delta={0} icon={BadgeCheck} />
              <TrendCard label="Candidates" value={counts.candidateUsers} delta={0} icon={Briefcase} />
              <TrendCard label="Employers" value={counts.employerUsers} delta={0} icon={Building2} />
              <TrendCard label="Unassigned" value={counts.unassignedUsers} delta={0} icon={Clock3} />
            </div>

            <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                {(['candidate', 'employer', 'unassigned'] as UserType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedUserType(type)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      selectedUserType === type
                        ? 'bg-[#1D9E75] text-white'
                        : 'bg-[#F1EFE8] text-[#6B6960] hover:bg-[#E1F5EE] hover:text-[#085041]'
                    }`}
                  >
                    {type === 'candidate' ? 'Candidates' : type === 'employer' ? 'Employers' : 'Unassigned'}
                  </button>
                ))}
              </div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">
                    All {selectedUserType === 'unassigned' ? 'unassigned' : selectedUserType} accounts
                  </h3>
                  <p className="mt-1 text-xs text-[#8A867E]">Every Auth account is included; onboarding status is shown separately.</p>
                </div>
                <span className="text-xs tabular-nums text-[#8A867E]">{filteredProfiles.length} accounts</span>
              </div>
              {filteredProfiles.length === 0 ? (
                <div className="rounded-xl bg-[#F1EFE8] p-6 text-center text-sm text-[#8A867E]">No users match your search.</div>
              ) : (
                <div className="divide-y divide-[#E5E1D8]">
                  {filteredProfiles.slice(0, 50).map((user) => (
                    <div key={user.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      {(() => {
                        const displayName = user.company_name || user.full_name || (user.account_type === 'employer' ? 'Unnamed employer' : user.account_type === 'candidate' ? 'Unnamed candidate' : 'Unassigned account');

                        return (
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#1A1A1A]">{displayName}</div>
                        <div className="mt-0.5 truncate text-xs text-[#8A867E]">{user.email || 'No email'} · Joined {formatRelative(user.created_at)}</div>
                      </div>
                        );
                      })()}
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#F1EFE8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.8px] text-[#5F5E5A]">
                          {user.account_type || 'unassigned'}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.8px] ${user.onboarding_completed ? 'bg-[#E1F5EE] text-[#085041]' : 'bg-[#FAEEDA] text-[#633806]'}`}>
                          {user.onboarding_completed ? 'Complete' : 'Incomplete'}
                        </span>
                        {user.account_status === 'deletion_scheduled' && (
                          <span className="rounded-full bg-[#FAEEDA] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.8px] text-[#633806]">
                            Deletion scheduled
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedView === 'analytics' && (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#1D9E75]">Platform usage</p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#1A1A1A]">Know what is moving on RoleWave.</h2>
              <p className="mt-2 text-sm text-[#6B6960]">A clean operational view of the marketplace activity currently available.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <UsageCard label="Total users" value={counts.totalUsers} detail={`${counts.candidateUsers} candidates`} />
              <UsageCard label="Employer accounts" value={counts.employerUsers} detail={`${counts.companies} companies`} />
              <UsageCard label="Active jobs" value={counts.activeJobs} detail={`${counts.filledJobs} filled`} />
              <UsageCard label="Pending review" value={counts.pendingSubmissions} detail={`${counts.reviewedSubmissions} reviewed`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1A1A1A]">User mix</h3>
                <div className="mt-5 space-y-4">
                  {[
                    { label: 'Candidates', value: counts.candidateUsers, tone: 'bg-[#1D9E75]' },
                    { label: 'Employers', value: counts.employerUsers, tone: 'bg-[#5B4088]' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-[#5F5E5A]">{item.label}</span>
                        <span className="font-semibold text-[#1A1A1A]">{item.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#F1EFE8]">
                        <div className={`h-2 rounded-full ${item.tone}`} style={{ width: `${Math.max(4, counts.totalUsers ? (item.value / counts.totalUsers) * 100 : 4)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1A1A1A]">Job board health</h3>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MiniMetric label="Active" value={counts.activeJobs} tone="text-[#085041]" />
                  <MiniMetric label="Filled" value={counts.filledJobs} tone="text-[#0C447C]" />
                  <MiniMetric label="Closed" value={counts.closedJobs} tone="text-[#5F5E5A]" />
                  <MiniMetric label="Archived" value={counts.archivedJobs} tone="text-[#633806]" />
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedView === 'newsletter' && (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#1D9E75]">Audience communication</p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#1A1A1A]">Send a RoleWave newsletter.</h2>
              <p className="mt-2 text-sm text-[#6B6960]">Only active subscribers are included. Every send is confirmed and recorded.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5 sm:p-6">
                <div className="space-y-4">
                  <Field label="Subject" required>
                    <input value={newsletterSubject} onChange={(e) => setNewsletterSubject(e.target.value)} className="admin-input" placeholder="New roles worth a look" />
                  </Field>
                  <Field label="Message" required>
                    <textarea value={newsletterBody} onChange={(e) => setNewsletterBody(e.target.value)} className="admin-input min-h-[220px] resize-y" placeholder="Write the newsletter message..." />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Button label">
                      <input value={newsletterCtaLabel} onChange={(e) => setNewsletterCtaLabel(e.target.value)} className="admin-input" placeholder="Browse jobs" />
                    </Field>
                    <Field label="Button URL">
                      <input type="url" value={newsletterCtaUrl} onChange={(e) => setNewsletterCtaUrl(e.target.value)} className="admin-input" placeholder="https://rolewave.cv/jobs" />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={sendNewsletter}
                    disabled={newsletterSending || newsletterLoading}
                    className="inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {newsletterSending ? 'Sending...' : 'Review and send'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[#5DCAA5] bg-[#E1F5EE] p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#085041]">Active subscribers</div>
                  <div className="mt-2 text-4xl font-bold tracking-[-0.05em] text-[#085041]">{newsletterLoading ? '...' : subscriberCount ?? 0}</div>
                  <p className="mt-2 text-xs leading-5 text-[#0F6E56]">This is the audience that will receive the next send.</p>
                </div>
                <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Recent sends</h3>
                  <div className="mt-3 space-y-3">
                    {newsletterSends.length === 0 ? (
                      <p className="text-xs text-[#8A867E]">No newsletter sends yet.</p>
                    ) : newsletterSends.map((send) => (
                      <div key={send.id} className="border-b border-[#E5E1D8] pb-3 last:border-0 last:pb-0">
                        <div className="truncate text-sm font-semibold text-[#1A1A1A]">{send.subject}</div>
                        <div className="mt-1 text-xs text-[#8A867E]">{formatRelative(send.created_at)} · {send.sent_count ?? 0} sent · {send.failed_count ?? 0} failed</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedView === 'team' && profile?.is_founder && (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#1D9E75]">Founder-only</p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#1A1A1A]">Manage the admin team.</h2>
              <p className="mt-2 text-sm text-[#6B6960]">
                Invites are the only way into the admin space. Only the exact invited email can accept.
              </p>
              <button
                type="button"
                onClick={sendAdminWelcomeToAll}
                disabled={adminWelcomeSending || adminRoster.length === 0}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] transition hover:border-[#5DCAA5] hover:text-[#085041] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={15} />
                {adminWelcomeSending ? 'Sending welcomes...' : 'Resend welcome to all admins'}
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5 sm:p-6">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Invite a new admin</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px] mb-1.5">First name</label>
                      <input value={inviteFirstName} onChange={(e) => setInviteFirstName(e.target.value)} placeholder="Samuel" className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px] mb-1.5">Last name</label>
                      <input value={inviteLastName} onChange={(e) => setInviteLastName(e.target.value)} placeholder="Ogabi" className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px] mb-1.5">
                        Email address
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="teammate@company.com"
                        className="admin-input"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={sendInvite}
                      disabled={inviteSending}
                      className="inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {inviteSending ? 'Sending...' : 'Send invite'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5 sm:p-6">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Pending & recent invites</h3>
                  <div className="mt-3 space-y-3">
                    {invitesLoading ? (
                      <p className="text-xs text-[#8A867E]">Loading invites...</p>
                    ) : invites.length === 0 ? (
                      <p className="text-xs text-[#8A867E]">No invites sent yet.</p>
                    ) : (
                      invites.map((invite) => {
                        const isRevoked = Boolean(invite.revoked_at);
                        const isAccepted = Boolean(invite.accepted_at);
                        const isExpired = !isAccepted && !isRevoked && new Date(invite.expires_at) <= new Date();
                        const isPending = !isAccepted && !isRevoked && !isExpired;
                        const statusLabel = isAccepted
                          ? 'Accepted'
                          : isRevoked
                          ? 'Revoked'
                          : isExpired
                          ? 'Expired'
                          : 'Pending';
                        const statusClass = isAccepted
                          ? 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]'
                          : isPending
                          ? 'bg-[#E6F1FB] text-[#0C447C] border-[#9AC0E8]'
                          : 'bg-[#F1EFE8] text-[#6B6960] border-[#D3D1C7]';

                        return (
                          <div
                            key={invite.id}
                            className="flex items-center justify-between gap-3 border-b border-[#E5E1D8] pb-3 last:border-0 last:pb-0"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-[#1A1A1A]">{invite.email}</div>
                              <div className="mt-1 text-xs text-[#8A867E]">
                                {invite.first_name ? `${invite.first_name}${invite.last_name ? ` ${invite.last_name}` : ''} Â· ` : ''}Sent {formatRelative(invite.created_at)}
                                {isPending ? ` · expires ${formatRelative(invite.expires_at)}` : ''}
                              </div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                                {statusLabel}
                              </span>
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => revokeInvite(invite)}
                                  disabled={revokingInviteId === invite.id}
                                  className="whitespace-nowrap rounded-lg border border-[#D3D1C7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#5F5E5A] hover:border-[#E8A98C] hover:text-[#712B13] disabled:opacity-60"
                                >
                                  {revokingInviteId === invite.id ? 'Revoking...' : 'Revoke'}
                                </button>
                              )}
                              {isRevoked && (
                                <button
                                  type="button"
                                  onClick={() => deleteRevokedInvite(invite)}
                                  disabled={deletingInviteId === invite.id}
                                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#E8A98C] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#712B13] hover:bg-[#FFF6F1] disabled:opacity-60"
                                >
                                  <Trash2 size={13} />
                                  {deletingInviteId === invite.id ? 'Deleting...' : 'Delete'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[#5DCAA5] bg-[#E1F5EE] p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#085041]">Current admins</div>
                  <div className="mt-2 text-4xl font-bold tracking-[-0.05em] text-[#085041]">{adminRoster.length}</div>
                  <p className="mt-2 text-xs leading-5 text-[#0F6E56]">Everyone with access to this dashboard.</p>
                </div>
                <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Admin roster</h3>
                  <div className="mt-3 space-y-3">
                    {adminRoster.map((admin) => (
                      <div key={admin.id} className="border-b border-[#E5E1D8] pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold text-[#1A1A1A]">
                            {admin.first_name || 'Admin'}
                          </div>
                          {admin.is_founder ? (
                            <span className="rounded-full border border-[#5DCAA5] bg-[#E1F5EE] px-2 py-0.5 text-[10px] font-semibold text-[#085041]">Founder</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => revokeAdminAccess(admin)}
                              disabled={revokingAdminId === admin.id}
                              className="rounded-lg border border-[#E8A98C] bg-white px-2 py-1 text-[10px] font-semibold text-[#712B13] hover:bg-[#FFF6F1] disabled:opacity-60"
                            >
                              {revokingAdminId === admin.id ? 'Removing...' : 'Remove access'}
                            </button>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[#8A867E]">
                          {admin.email || 'No email'} · Joined {formatRelative(admin.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedView === 'submissions' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              {(['pending', 'reviewed'] as SubmissionTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedSubmissionTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    selectedSubmissionTab === tab
                      ? 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]'
                      : 'bg-white text-[#5F5E5A] border-[#D3D1C7]'
                  }`}
                >
                  {tab === 'pending' ? `Pending (${counts.pendingSubmissions})` : `Reviewed (${selectedSubmissionSummary.reviewed})`}
                </button>
              ))}
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-8 text-center text-[#5F5E5A]">
                No {selectedSubmissionTab} submissions right now.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-2xl border border-[#D3D1C7] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-xl bg-[#E1F5EE] text-[#085041] flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {initials(submission.company_name) || 'CO'}
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-[#1A1A1A]">{submission.job_title}</h2>
                            <p className="text-sm text-[#5F5E5A] flex items-center gap-1">
                              <Building2 size={13} /> {submission.company_name} - {submission.city}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#E1F5EE] text-[#085041]">
                            {submission.work_type}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#F1EFE8] text-[#5F5E5A]">
                            {submission.job_type}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusTone(submission.status)}`}>
                            {formatStatus(submission.status)}
                          </span>
                        </div>

                        <p className="text-sm text-[#5F5E5A] leading-relaxed mt-3 max-w-3xl">
                          {submission.description}
                        </p>
                      </div>

                      <div className="flex flex-row gap-2 lg:flex-col lg:min-w-[180px]">
                        {submission.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleApproveSubmission(submission.id)}
                              disabled={processingId === submission.id}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-semibold disabled:opacity-60"
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button
                              onClick={() => handleRejectSubmission(submission.id)}
                              disabled={processingId === submission.id}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#D3D1C7] bg-white text-sm font-semibold text-[#5F5E5A] disabled:opacity-60"
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#D3D1C7] bg-[#F1EFE8] text-sm font-semibold text-[#5F5E5A]">
                              Reviewed
                            </div>
                            <button
                              onClick={() => handleRemoveReviewedSubmission(submission.id)}
                              disabled={processingId === submission.id}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#E2B5A8] bg-white text-sm font-semibold text-[#9B3E2B] disabled:opacity-60"
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedView === 'jobs' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {jobTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedJobTab(tab.key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      selectedJobTab === tab.key
                        ? 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]'
                        : 'bg-white text-[#5F5E5A] border-[#D3D1C7]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[#8A867E] tabular-nums">
                {filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'}
              </span>
            </div>

            {selectedJobIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#5DCAA5] bg-[#E1F5EE] px-4 py-2.5">
                <span className="text-sm font-semibold text-[#085041]">
                  {selectedJobIds.size} selected
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => bulkUpdateJobStatus('active')}
                  disabled={bulkProcessing}
                  className="text-xs font-semibold text-[#085041] hover:underline disabled:opacity-60"
                >
                  Reactivate
                </button>
                <button
                  onClick={() => bulkUpdateJobStatus('filled')}
                  disabled={bulkProcessing}
                  className="text-xs font-semibold text-[#0C447C] hover:underline disabled:opacity-60"
                >
                  Mark filled
                </button>
                <button
                  onClick={() => bulkUpdateJobStatus('closed')}
                  disabled={bulkProcessing}
                  className="text-xs font-semibold text-[#5F5E5A] hover:underline disabled:opacity-60"
                >
                  Close
                </button>
                <button
                  onClick={() => bulkUpdateJobStatus('archived')}
                  disabled={bulkProcessing}
                  className="text-xs font-semibold text-[#7A5000] hover:underline disabled:opacity-60"
                >
                  Archive
                </button>
                <button
                  onClick={() => setSelectedJobIds(new Set())}
                  className="text-xs font-semibold text-[#8A867E] hover:underline"
                >
                  Clear
                </button>
              </div>
            )}

            {filteredJobs.length === 0 ? (
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-8 text-center text-[#5F5E5A]">
                No jobs in this section yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#D3D1C7] bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#D3D1C7] bg-[#FBFAF7]">
                      <th className="w-10 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedJobIds.size > 0 && selectedJobIds.size === filteredJobs.length}
                          onChange={toggleAllJobsSelected}
                        />
                      </th>
                      <SortHeader label="Job" sortKey="title" current={jobSort} onSort={toggleJobSort} />
                      <SortHeader label="Company" sortKey="company" current={jobSort} onSort={toggleJobSort} />
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Location
                      </th>
                      <SortHeader label="Status" sortKey="status" current={jobSort} onSort={toggleJobSort} />
                      <SortHeader label="Posted" sortKey="created_at" current={jobSort} onSort={toggleJobSort} />
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job) => {
                      const company = companyMap.get(job.company_id) || job.company;
                      const isActive = job.status === 'active';

                      return (
                        <tr key={job.id} className="border-b border-[#EFEDE5] last:border-0 hover:bg-[#FBFAF7]">
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={selectedJobIds.has(job.id)}
                              onChange={() => toggleJobSelected(job.id)}
                            />
                          </td>
                          <td className="px-3 py-2.5 max-w-[280px]">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[#1A1A1A] truncate">{job.title}</span>
                              {job.featured && (
                                <span className="shrink-0 rounded-full bg-[#FFF8E6] border border-[#F0D080] px-1.5 py-0.5 text-[10px] font-semibold text-[#7A5000]">
                                  Featured
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#8A867E]">{job.work_type} - {job.job_type}</div>
                          </td>
                          <td className="px-3 py-2.5 text-[#5F5E5A] whitespace-nowrap">{company?.name || 'Unknown'}</td>
                          <td className="px-3 py-2.5 text-[#5F5E5A] whitespace-nowrap">{job.location}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${statusTone(job.status)}`}>
                              {formatStatus(job.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[#8A867E] whitespace-nowrap">{formatRelative(job.created_at)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {isActive ? (
                                <>
                                  <button
                                    onClick={() => handleJobStatus(job.id, 'filled')}
                                    disabled={processingId === job.id}
                                    title="Mark filled"
                                    className="rounded-md p-1.5 text-[#0C447C] hover:bg-[#E6F1FB] disabled:opacity-60"
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleJobStatus(job.id, 'closed')}
                                    disabled={processingId === job.id}
                                    title="Close"
                                    className="rounded-md p-1.5 text-[#5F5E5A] hover:bg-[#F1EFE8] disabled:opacity-60"
                                  >
                                    <CircleSlash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleJobStatus(job.id, 'active')}
                                    disabled={processingId === job.id}
                                    title="Reactivate"
                                    className="rounded-md p-1.5 text-[#085041] hover:bg-[#E1F5EE] disabled:opacity-60"
                                  >
                                    <PlayCircle size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleJobStatus(job.id, 'archived')}
                                    disabled={processingId === job.id}
                                    title="Archive"
                                    className="rounded-md p-1.5 text-[#7A5000] hover:bg-[#FFF8E6] disabled:opacity-60"
                                  >
                                    <ArchiveIcon />
                                  </button>
                                </>
                              )}
                              <Link
                                to={`/jobs/${job.slug}`}
                                target="_blank"
                                title="View live"
                                className="rounded-md p-1.5 text-[#5F5E5A] hover:bg-[#F1EFE8]"
                              >
                                <ExternalLink size={14} />
                              </Link>
                              <button
                                onClick={() => handleDeleteJob(job.id)}
                                disabled={processingId === job.id}
                                title="Delete"
                                className="rounded-md p-1.5 text-[#A15A00] hover:bg-[#FFF8E6] disabled:opacity-60"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {selectedView === 'companies' && (
          <div className="space-y-4">
            <span className="block text-xs text-[#8A867E] tabular-nums">
              {filteredCompanies.length} compan{filteredCompanies.length === 1 ? 'y' : 'ies'}
            </span>

            {filteredCompanies.length === 0 ? (
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-8 text-center text-[#5F5E5A]">
                No companies match your search.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#D3D1C7] bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#D3D1C7] bg-[#FBFAF7]">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Company
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Location
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Jobs
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Status
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((item) => (
                      <tr key={item.id} className="border-b border-[#EFEDE5] last:border-0 hover:bg-[#FBFAF7]">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <CompanyLogo
                              company={item}
                              size={32}
                              radiusClassName="rounded-lg"
                              textClassName="text-xs"
                              fallbackClassName="bg-[#F1EFE8] text-[#1A1A1A]"
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-[#1A1A1A] truncate">{item.name}</div>
                              {item.website && (
                                <a
                                  href={item.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-[#8A867E] hover:text-[#1D9E75] hover:underline truncate block"
                                >
                                  {item.website.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[#5F5E5A] whitespace-nowrap">{item.location || '-'}</td>
                        <td className="px-3 py-2.5 text-[#5F5E5A] tabular-nums">{item.job_count}</td>
                        <td className="px-3 py-2.5">
                          {item.verified ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#5DCAA5] bg-[#E1F5EE] px-2 py-0.5 text-xs font-semibold text-[#085041]">
                              <BadgeCheck size={11} /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-[#D3D1C7] bg-[#F1EFE8] px-2 py-0.5 text-xs font-medium text-[#5F5E5A]">
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => handleToggleVerified(item.id, !item.verified)}
                            disabled={processingId === item.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${
                              item.verified
                                ? 'border border-[#D3D1C7] bg-white text-[#5F5E5A]'
                                : 'bg-[#1D9E75] text-white'
                            }`}
                          >
                            <BadgeCheck size={12} /> {item.verified ? 'Unverify' : 'Verify'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {selectedView === 'create' && (
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="rounded-3xl border border-[#D3D1C7] bg-white p-5 sm:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1A1A]">Create a job</h2>
                  <p className="text-sm text-[#5F5E5A] mt-1">
                    Post directly to the board without waiting for a submission.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Job title" required>
                  <input
                    value={createForm.jobTitle}
                    onChange={(e) => updateCreateField('jobTitle', e.target.value)}
                    className="admin-input"
                    placeholder="Product Designer"
                  />
                </Field>
                <Field label="Company name" required>
                  <input
                    value={createForm.companyName}
                    onChange={(e) => updateCreateField('companyName', e.target.value)}
                    className="admin-input"
                    placeholder="Paystack"
                  />
                </Field>
                <Field label="Company website">
                  <input
                    value={createForm.companyWebsite}
                    onChange={(e) => updateCreateField('companyWebsite', e.target.value)}
                    className="admin-input"
                    placeholder="https://company.com"
                  />
                </Field>
                <Field label="City">
                  <select
                    value={createForm.city}
                    onChange={(e) => updateCreateField('city', e.target.value)}
                    className="admin-input"
                  >
                    <option>Lagos</option>
                    <option>Abuja</option>
                    <option>Port Harcourt</option>
                    <option>Remote</option>
                  </select>
                </Field>
                <Field label="Work type">
                  <select
                    value={createForm.workType}
                    onChange={(e) => updateCreateField('workType', e.target.value)}
                    className="admin-input"
                  >
                    <option>Remote</option>
                    <option>Hybrid</option>
                    <option>On-site</option>
                  </select>
                </Field>
                <Field label="Job type">
                  <select
                    value={createForm.jobType}
                    onChange={(e) => updateCreateField('jobType', e.target.value)}
                    className="admin-input"
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Internship</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={createForm.status}
                    onChange={(e) => updateCreateField('status', e.target.value as JobStatus)}
                    className="admin-input"
                  >
                    <option value="active">Active</option>
                    <option value="filled">Filled</option>
                    <option value="closed">Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
                <Field label="Salary">
                  <input
                    value={createForm.salary}
                    onChange={(e) => updateCreateField('salary', e.target.value)}
                    className="admin-input"
                    placeholder="₦400,000 - ₦600,000/month"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description" required>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => updateCreateField('description', e.target.value)}
                      className="admin-input min-h-[140px] resize-y"
                      placeholder="What is the role about?"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Requirements" required>
                    <textarea
                      value={createForm.requirements}
                      onChange={(e) => updateCreateField('requirements', e.target.value)}
                      className="admin-input min-h-[140px] resize-y"
                      placeholder="List the key requirements"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="What they’ll do">
                    <textarea
                      value={createForm.whatYoullDo}
                      onChange={(e) => updateCreateField('whatYoullDo', e.target.value)}
                      className="admin-input min-h-[120px] resize-y"
                      placeholder="Optional responsibilities"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Tags">
                    <input
                      value={createForm.tags}
                      onChange={(e) => updateCreateField('tags', e.target.value)}
                      className="admin-input"
                      placeholder="React, TypeScript, Remote"
                    />
                  </Field>
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-[#5F5E5A]">
                <input
                  type="checkbox"
                  checked={createForm.featured}
                  onChange={(e) => updateCreateField('featured', e.target.checked)}
                />
                Feature this job
              </label>

              <button
                type="button"
                onClick={createJob}
                disabled={savingJob}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white hover:bg-[#168a63] transition-colors disabled:opacity-60"
              >
                <PlusCircle size={14} />
                {savingJob ? 'Creating...' : 'Create job'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-[#D3D1C7] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-2">Quick rules</h3>
                <p className="text-sm text-[#5F5E5A] leading-relaxed">
                  Active jobs show on the public site. Filled, closed, and archived jobs stay in the
                  dashboard for history and can be reactivated later.
                </p>
              </div>
              <div className="rounded-3xl border border-[#D3D1C7] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Job lifecycle</h3>
                <div className="space-y-3 text-sm text-[#5F5E5A]">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-[#1D9E75]" />
                    Active jobs are visible to candidates.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-[#0C447C]" />
                    Filled jobs stay in records, but leave the public board.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-[#7A5000]" />
                    Closed and archived jobs remain manageable from this screen.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: import('react').ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
        {label} {required ? '*' : ''}
      </span>
      {children}
    </label>
  );
}

function TrendCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: number;
  delta: number;
  icon: import('lucide-react').LucideIcon;
}) {
  const isUp = delta > 0;
  const isFlat = delta === 0;

  return (
    <div className="rounded-2xl bg-white border border-[#D3D1C7] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px]">
          <Icon size={12} /> {label}
        </div>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <span className="text-2xl font-bold text-[#1A1A1A] tabular-nums">{value}</span>
        {!isFlat && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
              isUp ? 'text-[#085041]' : 'text-[#A15A00]'
            }`}
          >
            {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-[#B4B2A9]">vs. previous week</div>
    </div>
  );
}

function UsageCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#D3D1C7] bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[1px] text-[#8A867E]">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[#1A1A1A]">{value}</div>
      <div className="mt-1 text-xs text-[#8A867E]">{detail}</div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-[#F1EFE8] px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[1px] text-[#8A867E]">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: JobSortKey;
  current: { key: JobSortKey; dir: SortDir };
  onSort: (key: JobSortKey) => void;
}) {
  const active = current.key === sortKey;

  return (
    <th className="px-3 py-2.5 text-left">
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.5px] ${
          active ? 'text-[#1A1A1A]' : 'text-[#8A867E]'
        }`}
      >
        {label}
        {active ? (
          current.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
        ) : (
          <ArrowUpDown size={11} className="opacity-50" />
        )}
      </button>
    </th>
  );
}

function ArchiveIcon() {
  return <span className="text-[14px] leading-none">⭳</span>;
}

