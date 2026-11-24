import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AchievementDetail from './pages/AchievementDetail';
import AthleteDetail from './pages/AthleteDetail';
import Athletes from './pages/Athletes';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import { useAuth } from './auth';
import { LoadingState } from './components/States';

export default function App() {
  const { user, isInitializing } = useAuth();
  const protectedPage = (page: ReactNode) => user
    ? page
    : isInitializing
      ? <LoadingState label="Restoring your session…" />
      : <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="athletes" element={protectedPage(<Athletes />)} />
        <Route path="achievements/:id" element={protectedPage(<AchievementDetail />)} />
        <Route path="achievements" element={<Navigate to="/#achievements" replace />} />
        <Route path="highlights" element={<Navigate to="/#achievements" replace />} />
        <Route path="athletes/:id" element={protectedPage(<AthleteDetail />)} />
        <Route path="login" element={<AuthPage key="login" mode="login" />} />
        <Route path="register" element={<AuthPage key="register" mode="register" />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="dashboard" element={protectedPage(<Dashboard />)} />
        <Route path="events" element={protectedPage(<Events />)} />
        <Route path="events/:id" element={protectedPage(<EventDetail />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
