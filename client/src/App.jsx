import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { PageLoader } from './components/ui/LoadingSpinner';

// Public
import Landing from './pages/public/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import GoogleCallback from './pages/auth/GoogleCallback';

// Layout & protected
import AppLayout from './components/layout/AppLayout';

// Pages
import Dashboard from './pages/dashboard/Dashboard';
import Subjects from './pages/subjects/Subjects';
import SubjectDetail from './pages/subjects/SubjectDetail';
import Tasks from './pages/tasks/Tasks';
import TaskDetail from './pages/tasks/TaskDetail';
import CalendarPage from './pages/calendar/CalendarPage';
import Notes from './pages/notes/Notes';
import NoteEditor from './pages/notes/NoteEditor';
import Assistant from './pages/ai/Assistant';
import Quizzes from './pages/quizzes/Quizzes';
import Sessions from './pages/sessions/Sessions';
import Analytics from './pages/analytics/AnalyticsPage';
import Search from './pages/search/SearchPage';
import Profile from './pages/profile/Profile';
import Settings from './pages/settings/Settings';
import NotFound from './pages/NotFound';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
      <Route path="/auth/callback" element={<GoogleCallback />} />

      {/* Authenticated */}
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/subjects" element={<Protected><Subjects /></Protected>} />
      <Route path="/subjects/:id" element={<Protected><SubjectDetail /></Protected>} />
      <Route path="/tasks" element={<Protected><Tasks /></Protected>} />
      <Route path="/tasks/:id" element={<Protected><TaskDetail /></Protected>} />
      <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
      <Route path="/notes" element={<Protected><Notes /></Protected>} />
      <Route path="/notes/new" element={<Protected><NoteEditor /></Protected>} />
      <Route path="/notes/:id" element={<Protected><NoteEditor /></Protected>} />
      <Route path="/assistant" element={<Protected><Assistant /></Protected>} />
      <Route path="/quizzes" element={<Protected><Quizzes /></Protected>} />
      <Route path="/sessions" element={<Protected><Sessions /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/search" element={<Protected><Search /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}