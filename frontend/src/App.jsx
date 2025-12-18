import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SystemFlow from './pages/SystemFlow';
import SystemFlow2 from './pages/SystemFlow2';
import SystemFlow3 from './pages/SystemFlow3';
import Home from './pages/Home';
import MyPage from './pages/MyPage';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import ProjectDashboard from './pages/ProjectDashboard';
import Scans from './pages/Scans';
import ScansDashboard from './pages/ScansDashboard';
import Findings from './pages/Findings';
import Reports from './pages/Reports';
import authService from './services/authService';

// Protected Route Component
function ProtectedRoute({ children }) {
  const location = useLocation();
  return authService.isAuthenticated()
    ? children
    : <Navigate to="/login" state={{ from: location }} replace />;
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/system-flow" element={<SystemFlow />} />
        <Route path="/system-flow2" element={<SystemFlow2 />} />
        <Route path="/system-flow3" element={<SystemFlow3 />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route
          path="/mypage"
          element={
            <ProtectedRoute>
              <MyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:id"
          element={
            <ProtectedRoute>
              <ProjectDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:id/scans"
          element={
            <ProtectedRoute>
              <Scans />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:id/scans/dashboard"
          element={
            <ProtectedRoute>
              <ScansDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:id/findings"
          element={
            <ProtectedRoute>
              <Findings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:id/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
