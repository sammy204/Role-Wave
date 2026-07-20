import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
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
import MarketplaceEntry from './pages/MarketplaceEntry';
import CandidateDashboard from './pages/CandidateDashboard';
import CandidateProfile from './pages/CandidateProfile';
import CandidateHome from './pages/CandidateHome';
import CandidateActivity from './pages/CandidateActivity';
import EmployerOnboarding from './pages/EmployerOnboarding';
import JobApplication from './pages/JobApplication';
import EmployerDashboard from './pages/EmployerDashboard';
import CandidateMessages from './pages/CandidateMessages';
import EmployerMessages from './pages/EmployerMessages';
import CandidateMobileNav from './components/CandidateMobileNav';

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
  const [profile, setProfile] = useState<Profile | null>(null);

  const isAdminRoute = path.startsWith('/admin');
  const isApplyRoute = /^\/jobs\/[^/]+\/apply$/.test(path);
  const isEmployerRoute = path.startsWith('/employer') || path === '/post';
  const isCandidateOnlyRoute = path.startsWith('/candidate');
  const isSharedBrowseRoute = path === '/jobs' || (/^\/jobs\/[^/]+$/.test(path) && !isApplyRoute);
  const isSidebarUtilityRoute = path === '/about' || path === '/contact';

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
    !isAdminRoute && !isApplyRoute && !isEmployerRoute && !showCandidateSidebar && path !== '/start';

  useEffect(() => {
    if (authLoading) return;

    let alive = true;

    if (!session) {
      setProfile(null);
      return;
    }

    void (async () => {
      try {
        const nextProfile = await fetchProfile(session.user.id);
        if (alive) setProfile(nextProfile);
      } catch {
        if (alive) setProfile(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, session]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate('/', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const routes = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/jobs" element={<JobListings />} />
      <Route path="/jobs/:slug" element={<JobDetail />} />
      <Route path="/jobs/:slug/apply" element={<JobApplication />} />
      <Route path="/start" element={<MarketplaceEntry />} />
      <Route path="/candidate" element={<CandidateDashboard />} />
      <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
      <Route path="/candidate/profile" element={<CandidateProfile />} />
      <Route path="/candidate/home" element={<CandidateHome />} />
      <Route path="/candidate/activity" element={<CandidateActivity />} />
      <Route path="/candidate/messages" element={<CandidateMessages />} />
      <Route path="/employer/onboarding" element={<EmployerOnboarding />} />
      <Route path="/employer/dashboard" element={<EmployerDashboard />} />
      <Route path="/employer/messages" element={<EmployerMessages />} />
      <Route path="/post" element={<PostJob />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route element={<AdminGuard />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
    </Routes>
  );

  if (showCandidateSidebar) {
    return <CandidateSidebar>{routes}</CandidateSidebar>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F1EFE8]">
      {showPublicChrome && <Navbar />}
      {isEmployerRoute && <WorkspaceNav role="employer" />}
      <main className="flex-1">{routes}</main>
      <CandidateMobileNav />
      {showPublicChrome && <Footer />}
    </div>
  );
}

export default App;