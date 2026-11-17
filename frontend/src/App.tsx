import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AthleteDetail from './pages/AthleteDetail';
import Athletes from './pages/Athletes';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import { useAuth } from './auth';

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="athletes" element={user ? <Athletes /> : <Navigate to="/login" replace />} />
        <Route path="achievements" element={<Navigate to="/#achievements" replace />} />
        <Route path="highlights" element={<Navigate to="/#achievements" replace />} />
        <Route path="athletes/:id" element={user ? <AthleteDetail /> : <Navigate to="/login" replace />} />
        <Route path="login" element={<AuthPage key="login" mode="login" />} />
        <Route path="register" element={<AuthPage key="register" mode="register" />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
