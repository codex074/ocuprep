import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
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
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
