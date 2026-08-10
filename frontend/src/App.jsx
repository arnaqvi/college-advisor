import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import TierGate from './components/TierGate.jsx'
import Layout from './components/Layout.jsx'
import Homepage from './pages/Homepage.jsx'
import RoleSelect from './pages/RoleSelect.jsx'
import StudentLogin from './pages/StudentLogin.jsx'
import ParentLogin from './pages/ParentLogin.jsx'
import CounselorLogin from './pages/CounselorLogin.jsx'
import StudentRegister from './pages/StudentRegister.jsx'
import ParentRegister from './pages/ParentRegister.jsx'
import CounselorRequestAccess from './pages/CounselorRequestAccess.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import CollegeDirectory from './pages/CollegeDirectory.jsx'
import Programs from './pages/Programs.jsx'
import HiddenGems from './pages/HiddenGems.jsx'
import Scholarships from './pages/Scholarships.jsx'
import Timeline from './pages/Timeline.jsx'
import Strategy from './pages/Strategy.jsx'
import Profile from './pages/Profile.jsx'
import EssayTracker from './pages/EssayTracker.jsx'
import Compare from './pages/Compare.jsx'
import CounselorBiasCheck from './pages/CounselorBiasCheck.jsx'
import GapAnalysis from './pages/GapAnalysis.jsx'
import Pricing from './pages/Pricing.jsx'
import PricingSuccess from './pages/PricingSuccess.jsx'
import PricingCancel from './pages/PricingCancel.jsx'
import AboutUs from './pages/AboutUs.jsx'
import ChildSafety from './pages/ChildSafety.jsx'
import { OnboardingLayout } from './features/onboarding/OnboardingLayout'

// import.meta.env.BASE_URL mirrors the `base` set in vite.config.js, so routes
// resolve correctly whether served at "/" (production) or the Coder proxy
// subpath "/@{owner}/{workspace}/apps/code-server/proxy/5173/" (local dev).
function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <AuthProvider>
        <AppProvider>
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/child-safety" element={<ChildSafety />} />

            {/* Role-based auth flow */}
            <Route path="/login" element={<RoleSelect />} />
            <Route path="/login/student" element={<StudentLogin />} />
            <Route path="/login/parent" element={<ParentLogin />} />
            <Route path="/login/counselor" element={<CounselorLogin />} />
            <Route path="/register/student" element={<StudentRegister />} />
            <Route path="/register/parent" element={<ParentRegister />} />
            <Route path="/request-access" element={<CounselorRequestAccess />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/onboarding/*" element={<OnboardingLayout />} />

            {/* Shared app shell — requires login (any role). Free tier reaches
                Dashboard/Colleges/Profile/Pricing; everything else needs a
                paid plan (TierGate), matching Layout.jsx's nav gating. */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/pricing/success" element={<PricingSuccess />} />
                <Route path="/pricing/cancel" element={<PricingCancel />} />
                <Route path="/colleges" element={<CollegeDirectory />} />
                <Route path="/profile" element={<Profile />} />
                <Route element={<TierGate />}>
                  <Route path="/programs" element={<Programs />} />
                  <Route path="/hidden-gems" element={<HiddenGems />} />
                  <Route path="/scholarships" element={<Scholarships />} />
                  <Route path="/timeline" element={<Timeline />} />
                  <Route path="/strategy" element={<Strategy />} />
                  <Route path="/essays" element={<EssayTracker />} />
                  <Route path="/compare" element={<Compare />} />
                  <Route path="/bias-check" element={<CounselorBiasCheck />} />
                  <Route path="/gap-analysis" element={<GapAnalysis />} />
                </Route>
              </Route>
            </Route>

            {/* Role-guarded dashboards — only reachable by a logged-in account
                whose session role matches. */}
            <Route element={<ProtectedRoute allowedRole="student" />}>
              <Route element={<Layout />}>
                <Route path="/student-dashboard" element={<Dashboard />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute allowedRole="parent" />}>
              <Route element={<Layout />}>
                <Route path="/parent-dashboard" element={<Dashboard />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute allowedRole="counselor" />}>
              <Route element={<Layout />}>
                <Route path="/counselor-dashboard" element={<Dashboard />} />
              </Route>
            </Route>
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
