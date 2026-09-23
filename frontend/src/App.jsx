import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Logo, Avatar, Icon } from './components/ui';
import Login from './pages/Login';
import Register from './pages/Register';
import TeacherDashboard from './pages/TeacherDashboard';
import CourseDetail from './pages/CourseDetail';
import SessionPage from './pages/SessionPage';
import StudentDashboard from './pages/StudentDashboard';
import FaceRegister from './pages/FaceRegister';
import CheckIn from './pages/CheckIn';

function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'teacher' ? <TeacherDashboard /> : <StudentDashboard />;
}

export default function App() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const isAuthPage = pathname === '/login' || pathname === '/register';

  return (
    <>
      {!isAuthPage && (
        <header className="topbar">
          <Link to="/" className="brand"><Logo /> <span>SmartAttend</span></Link>
          {user && (
            <div className="userbox">
              <div className="who">
                <b>{user.name}</b>
                <small>{user.role}</small>
              </div>
              <Avatar name={user.name} size={36} />
              <button className="btn ghost icon" onClick={logout} title="Logout" aria-label="Logout">
                <Icon name="logout" />
              </button>
            </div>
          )}
        </header>
      )}
      <main className={isAuthPage ? '' : 'container'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/course/:id" element={<Protected role="teacher"><CourseDetail /></Protected>} />
          <Route path="/session/:id" element={<Protected role="teacher"><SessionPage /></Protected>} />
          <Route path="/face" element={<Protected role="student"><FaceRegister /></Protected>} />
          <Route path="/checkin/:id" element={<Protected role="student"><CheckIn /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
