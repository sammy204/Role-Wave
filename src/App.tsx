import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WorkspaceNav from './components/WorkspaceNav';
import CandidateSidebar from './components/CandidateSidebar';
import AdminGuard from './components/AdminGuard';
import { supabase } from './lib/supabase';
import { fetchProfile } from './lib/admin';
import { useAuth } from './lib/useAuth';
import type { Profile } from './types';
import Home from './pages/Home';
import JobListings from './pages/JobListings';
import JobDetail from './pages/JobDetail';
import PostJob from './pages/PostJob';
import About from './pages/About';
import Contact from './pages/Contact';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AuthLayout from './pages/AuthLayout';
import Confirmed from './pages/Confirmed';
import ResetPassword from './pages/ResetPassword';
import CandidateOnboarding from './pages/CandidateOnboarding';
import CandidateDashboard from './pages/CandidateDashboard';
import CandidateProfile from './pages/CandidateProfile';
import CandidateHome from './pages/CandidateHome';
import CandidateActivity from './pages/CandidateActivity';
import CandidateOffers from './pages/CandidateOffers';
import RolePilot from './pages/RolePilot';
import RoleWavePro from './pages/RoleWavePro';
import EmployerOnboarding from './pages/EmployerOnboarding';
import EmployerSettings from './pages/EmployerSettings';
import JobApplication from './pages/JobApplication';
import EmployerDashboard from './pages/EmployerDashboard';
import CandidateMessages from './pages/CandidateMessages';
import EmployerMessages from './pages/EmployerMessages';
import CookieConsent from './components/CookieConsent';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import InstallPrompt from './components/InstallPrompt';
import PushNotificationPrompt from './components/PushNotificationPrompt';
import ResumeViewer from './pages/ResumeViewer';
import CandidateSettings from './pages/CandidateSettings';
import AccountDeletionScheduled from './pages/AccountDeletionScheduled';
import PwaOnboarding from './pages/PwaOnboarding';
import NotFound from './pages/NotFound';
import Faq from './pages/Faq';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import CookiePolicy from './pages/CookiePolicy';
import Unsubscribe from './pages/Unsubscribe';
import MessageToastHost from './components/MessageToastHost';
import InAppTutorial from './components/InAppTutorial';
import { usePresenceHeartbeat } from './hooks/usePresenceHeartbeat';
import { useIsPwa } from './lib/usePwaDisplayMode';

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { session, loading: authLoading } = useAuth();
  const isPwa = useIsPwa();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    // Job detail pages set a more specific title once the job has loaded.
    if (/^\/jobs\/[^/]+$/.test(path)) return;

    const title = path === '/'
      ? 'Verified Jobs in Nigeria | RoleWave'
      : path === '/jobs'
        ? 'Browse Verified Jobs in Nigeria | RoleWave'
        : /^\/jobs\/[^/]+\/apply$/.test(path)
          ? 'Apply for a Job | RoleWave'
          : path === '/start'
            ? 'Sign In or Create an Account | RoleWave'
            : path === '/welcome'
              ? 'Welcome to RoleWave'
              : path === '/confirmed'
                ? 'Email Confirmed | RoleWave'
                : path === '/account-deletion-scheduled'
                  ? 'Account Deletion Scheduled | RoleWave'
                  : path === '/candidate' || path === '/candidate/dashboard'
                    ? 'Candidate Dashboard | RoleWave'
                    : path === '/candidate/home'
                      ? 'Candidate Home | RoleWave'
                      : path === '/candidate/profile'
                        ? 'My Candidate Profile | RoleWave'
                        : path === '/candidate/settings'
                          ? 'Account Settings | RoleWave'
                          : path === '/candidate/activity'
                            ? 'Application Activity | RoleWave'
                            : path === '/candidate/offers'
                              ? 'My Offers | RoleWave'
                            : path === '/candidate/role-pilot'
                              ? 'Role Pilot | RoleWave'
                            : path === '/candidate/pro'
                              ? 'RoleWave Pro | RoleWave'
                            : path === '/candidate/messages'
                              ? 'Candidate Messages | RoleWave'
                          : path === '/employer/onboarding'
                                ? 'Employer Onboarding | RoleWave'
                                : path === '/employer/settings'
                                  ? 'Employer Settings | RoleWave'
                                : path === '/employer' || path === '/employer/dashboard'
                                  ? 'Employer Dashboard | RoleWave'
                                  : path === '/employer/messages'
                                    ? 'Employer Messages | RoleWave'
                                    : path === '/post'
                                      ? 'Post a Job | RoleWave'
                                      : path === '/about'
                                        ? 'About RoleWave'
                                        : path === '/contact'
                                        ? 'Contact RoleWave'
                                        : path === '/faq'
                                        ? 'Frequently Asked Questions | RoleWave'
                                        : path === '/blog'
                                          ? 'RoleWave Blog | Career Resources'
                                        : /^\/blog\/[^/]+$/.test(path)
                                          ? 'Article | RoleWave Blog'
                                        : path === '/cookie-policy'
                                          ? 'Cookie Policy | RoleWave'
                                        : path === '/unsubscribe'
                                          ? 'Unsubscribe | RoleWave'
                                        : path === '/privacy'
                                            ? 'Privacy Policy | RoleWave'
                                            : path === '/terms'
                                              ? 'Terms of Service | RoleWave'
                                              : path === '/admin/login'
                                                ? 'Admin Login | RoleWave'
                                                : path === '/admin'
                                                  ? 'Admin Dashboard | RoleWave'
                                                  : path === '/resume/view'
                                                    ? 'Resume Viewer | RoleWave'
                                                    : 'Page Not Found | RoleWave';

    document.title = title;
  }, [path]);

  // Reflects "this tab is open and visible" server-side so send-message-push
  // can skip the push and let MessageToastHost handle it instead.
  usePresenceHeartbeat(session?.user.id ?? null);

  const isAdminRoute = path.startsWith('/admin');
  const isPwaLegalRoute = isPwa && (path === '/privacy' || path === '/terms' || path === '/cookie-policy');
  const isApplyRoute = /^\/jobs\/[^/]+\/apply$/.test(path);
  const isEmployerRoute = path.startsWith('/employer') || path === '/post';
  const isCandidateOnlyRoute = path.startsWith('/candidate');
  const isSharedBrowseRoute = path === '/jobs' || (/^\/jobs\/[^/]+$/.test(path) && !isApplyRoute);
  const isSidebarUtilityRoute = path === '/about' || path === '/contact' || path === '/faq';

  const isSignedIn = !!session;
  const isCandidate = profile?.account_type === 'candidate';

  // Sidebar covers: any /candidate/* route once signed in (the page itself
  // enforces role-correctness), plus /jobs and /jobs/:slug once we know the
  // signed-in user is specifically a candidate (avoids flashing the sidebar
  // for signed-in employers browsing jobs).
  const showCandidateSidebar =
    !isAdminRoute &&
    !isApplyRoute &&
    !isEmployerRoute &&
    isSignedIn &&
    (isCandidateOnlyRoute || (isSharedBrowseRoute && isCandidate) || isSidebarUtilityRoute);

  const showPublicChrome =
    !isAdminRoute &&
    !isApplyRoute &&
    !isEmployerRoute &&
    !showCandidateSidebar &&
    !isPwaLegalRoute &&
    path !== '/start' &&
    path !== '/confirmed' &&
    path !== '/welcome';

  const tutorialRole = profile?.account_type === 'employer' ? 'employer' : profile?.account_type === 'candidate' ? 'candidate' : null;
  const tutorialPaths = tutorialRole === 'candidate'
    ? ['/candidate', '/candidate/dashboard', '/candidate/profile', '/jobs', '/candidate/activity', '/candidate/offers', '/candidate/messages']
    : ['/employer', '/employer/dashboard', '/post', '/employer/messages'];
  const tutorialActive = Boolean(
    session && tutorialRole && tutorialPaths.includes(path)
  );
  const tutorialAutoStart = Boolean(
    session && tutorialRole &&
      (tutorialRole === 'candidate'
        ? path === '/candidate' || path === '/candidate/dashboard'
        : path === '/employer' || path === '/employer/dashboard')
  );

  useEffect(() => {
    if (authLoading) return;

    let alive = true;

    if (!session) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    void (async () => {
      try {
        const nextProfile = await fetchProfile(session.user.id);
        if (alive) setProfile(nextProfile);
      } catch {
        if (alive) setProfile(null);
      } finally {
        if (alive) setProfileLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, session]);

  useEffect(() => {
    if (!isPwa) return;

    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    document.documentElement.classList.add('pwa-app');
    document.addEventListener('contextmenu', preventContextMenu);

    return () => {
      document.documentElement.classList.remove('pwa-app');
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [isPwa]);

  useEffect(() => {
    if (!isPwa) return;

    let startX: number | null = null;
    let startY: number | null = null;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startX === null || startY === null || !event.cancelable) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const target = event.target as HTMLElement | null;
      const isTextField = Boolean(target?.closest('input, textarea, [contenteditable="true"]'));

      if (!isTextField && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        event.preventDefault();
      }
    };

    const clearTouch = () => {
      startX = null;
      startY = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', clearTouch, { passive: true });
    document.addEventListener('touchcancel', clearTouch, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', clearTouch);
      document.removeEventListener('touchcancel', clearTouch);
    };
  }, [isPwa]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        const scheduledFor = sessionStorage.getItem('rolewave-account-deletion-scheduled');
        if (scheduledFor) {
          sessionStorage.removeItem('rolewave-account-deletion-scheduled');
          navigate(`/account-deletion-scheduled?date=${encodeURIComponent(scheduledFor)}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [isPwa, navigate]);

  // Installed apps should enter through their app-specific onboarding screen
  // immediately, without first mounting the public homepage at "/".
  if (isPwa && path === '/') {
    if (authLoading || (session && profileLoading)) {
      return <div className="min-h-screen bg-[#F1EFE8]" aria-label="Loading" />;
    }

    if (!session) return <PwaOnboarding />;

    return <Navigate to={profile?.account_type === 'employer' ? '/employer/dashboard' : '/candidate/dashboard'} replace />;
  }

  const routes = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/jobs" element={<JobListings />} />
      <Route path="/jobs/:slug" element={<JobDetail />} />
      <Route path="/jobs/:slug/apply" element={<JobApplication />} />
      <Route path="/start" element={<AuthLayout />} />
      <Route path="/welcome" element={<PwaOnboarding />} />
      <Route path="/account-deletion-scheduled" element={<AccountDeletionScheduled />} />
      <Route path="/confirmed" element={<Confirmed />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/resume/view" element={<ResumeViewer />} />
      <Route path="/candidate" element={<CandidateDashboard />} />
      <Route path="/candidate/onboarding" element={<CandidateOnboarding />} />
      <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
      <Route path="/candidate/profile" element={<CandidateProfile />} />
      <Route path="/candidate/settings" element={<CandidateSettings />} />
      <Route path="/candidate/home" element={<CandidateHome />} />
      <Route path="/candidate/activity" element={<CandidateActivity />} />
      <Route path="/candidate/offers" element={<CandidateOffers />} />
      <Route path="/candidate/role-pilot" element={<RolePilot />} />
      <Route path="/candidate/pro" element={<RoleWavePro />} />
      <Route path="/candidate/messages" element={<CandidateMessages />} />
      <Route path="/employer/onboarding" element={<EmployerOnboarding />} />
      <Route path="/employer/settings" element={<EmployerSettings />} />
      <Route path="/employer" element={<EmployerDashboard />} />
      <Route path="/employer/dashboard" element={<EmployerDashboard />} />
      <Route path="/employer/messages" element={<EmployerMessages />} />
      <Route path="/post" element={<PostJob />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/cookie-policy" element={<CookiePolicy />} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route element={<AdminGuard />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );

  if (isPwaLegalRoute) {
    return <>{routes}</>;
  }

  if (showCandidateSidebar) {
    return (
      <>
        <CandidateSidebar>{routes}</CandidateSidebar>
        <CookieConsent />
        <InstallPrompt />
        <PushNotificationPrompt />
        <MessageToastHost />
        {tutorialRole && session && <InAppTutorial userId={session.user.id} role={tutorialRole} active={tutorialActive} autoStart={tutorialAutoStart} />}
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F1EFE8]">
      {showPublicChrome && <Navbar />}
      {isEmployerRoute && <WorkspaceNav role="employer" />}
      <main className="flex-1">{routes}</main>
      {showPublicChrome && <Footer />}
      <CookieConsent />
      <InstallPrompt />
      <PushNotificationPrompt />
      <MessageToastHost />
      {tutorialRole && session && <InAppTutorial userId={session.user.id} role={tutorialRole} active={tutorialActive} autoStart={tutorialAutoStart} />}
    </div>
  );
}

export default App;
