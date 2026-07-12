import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WorkspaceNav from './components/WorkspaceNav';
import AdminGuard from './components/AdminGuard';
import { supabase } from './lib/supabase';
import Home from './pages/Home';
import JobListings from './pages/JobListings';
import JobDetail from './pages/JobDetail';
import PostJob from './pages/PostJob';
import About from './pages/About';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import MarketplaceEntry from './pages/MarketplaceEntry';
import CandidateDashboard from './pages/CandidateDashboard';
import CandidateHome from './pages/CandidateHome';
import CandidateActivity from './pages/CandidateActivity';
import CandidateProfileSetup from './pages/CandidateProfileSetup';
import EmployerOnboarding from './pages/EmployerOnboarding';
import JobApplication from './pages/JobApplication';
import EmployerDashboard from './pages/EmployerDashboard';
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
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isEmployerRoute =
    location.pathname.startsWith('/employer') || location.pathname === '/post';
  const isWorkspaceRoute = isEmployerRoute;

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

  return (
    <div className="min-h-screen flex flex-col bg-[#F1EFE8]">
      {!isAdminRoute && !isWorkspaceRoute && location.pathname !== '/start' && <Navbar />}
      {isEmployerRoute && <WorkspaceNav role="employer" />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<JobListings />} />
          <Route path="/jobs/:slug" element={<JobDetail />} />
          <Route path="/jobs/:slug/apply" element={<JobApplication />} />
          <Route path="/start" element={<MarketplaceEntry />} />
          <Route path="/candidate" element={<CandidateDashboard />} />
          <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
          <Route path="/candidate/home" element={<CandidateHome />} />
          <Route path="/candidate/activity" element={<CandidateActivity />} />
          <Route path="/candidate/profile" element={<CandidateProfileSetup />} />
          <Route path="/employer/onboarding" element={<EmployerOnboarding />} />
          <Route path="/employer/dashboard" element={<EmployerDashboard />} />
          <Route path="/post" element={<PostJob />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<AdminGuard />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </main>
      <CandidateMobileNav />
      {!isAdminRoute && !isWorkspaceRoute && location.pathname !== '/start' && <Footer />}
    </div>
  );
}

export default App;
