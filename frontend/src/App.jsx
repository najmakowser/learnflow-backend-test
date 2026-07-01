import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, getDefaultRouteForRole } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TrainingCatalog from './pages/TrainingCatalog';
import ManagerNomination from './pages/ManagerNomination';
import ManagerApproval from './pages/ManagerApproval';
import FinalizedParticipants from './pages/FinalizedParticipants';
import RMCourseRequest from './pages/RMCourseRequest';
import WorkflowTracker from './pages/WorkflowTracker';
import AuditLogs from './pages/AuditLogs';
import ReleaseNotifications from './pages/ReleaseNotifications';

function AppShell() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const defaultPath = getDefaultRouteForRole(user.role);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route path="/login" element={<Navigate to={defaultPath} replace />} />

          <Route path="/" element={
            <ProtectedRoute path="/">
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/catalog" element={
            <ProtectedRoute path="/catalog">
              <TrainingCatalog />
            </ProtectedRoute>
          } />
          <Route path="/nominate" element={
            <ProtectedRoute path="/nominate">
              <ManagerNomination />
            </ProtectedRoute>
          } />
          <Route path="/rm-course-request" element={
            <ProtectedRoute path="/rm-course-request">
              <RMCourseRequest />
            </ProtectedRoute>
          } />
          <Route path="/ld-validation" element={<Navigate to="/manager-approval" replace />} />
          <Route path="/manager-approval" element={
            <ProtectedRoute path="/manager-approval">
              <ManagerApproval />
            </ProtectedRoute>
          } />
          <Route path="/participants" element={
            <ProtectedRoute path="/participants">
              <FinalizedParticipants />
            </ProtectedRoute>
          } />
          <Route path="/workflow" element={
            <ProtectedRoute path="/workflow">
              <WorkflowTracker />
            </ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute path="/notifications">
              <ReleaseNotifications />
            </ProtectedRoute>
          } />
          <Route path="/audit" element={
            <ProtectedRoute path="/audit">
              <AuditLogs />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to={defaultPath} replace />} />
        </Routes>
      </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
