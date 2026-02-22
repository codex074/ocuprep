import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PreparePage from './pages/PreparePage';
import HistoryPage from './pages/HistoryPage';
import FormulasPage from './pages/FormulasPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import StationSelectionPage from './pages/StationSelectionPage';
import ForceChangePasswordPage from './pages/ForceChangePasswordPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/force-change-password" replace />;
  return <>{children}</>;
}

function RequireStation({ children }: { children: ReactNode }) {
  const { location, loading } = useAuth();
  if (loading) return null;
  if (!location) return <Navigate to="/station-select" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (user.must_change_password) return <Navigate to="/force-change-password" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/force-change-password" element={
        <RequireAuth>
          <ForceChangePasswordPage />
        </RequireAuth>
      } />
      <Route path="/station-select" element={<ProtectedRoute><StationSelectionPage /></ProtectedRoute>} />
      
      <Route element={<ProtectedRoute><RequireStation><Layout /></RequireStation></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/prepare" element={<PreparePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/formulas" element={<FormulasPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// Simple wrapper just to ensure user is logged in, but allows must_change_password
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  );
}
