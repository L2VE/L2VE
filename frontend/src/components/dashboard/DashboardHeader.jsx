import { Link } from 'react-router-dom';
import ThemeToggle from '../common/ThemeToggle';
import TimeFilter from '../common/TimeFilter';

function DashboardHeader({ 
  id, 
  isDark, 
  setIsDark, 
  timeFilter, 
  setTimeFilter, 
  user, 
  handleLogout,
  theme 
}) {
  return (
    <>
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 h-16 ${isDark ? 'bg-gray-800' : 'bg-white'} border-b-4 ${isDark ? 'border-blue-900' : 'border-blue-200'} shadow-sm z-50 flex items-center px-6`}>
        <div className="flex items-center space-x-8 flex-1">
          <Link to="/home" className="flex items-center space-x-2.5 hover:opacity-80 transition-opacity">
            <img src="/images/logo.png" alt="L2VE" className="h-7 w-auto" />
            <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              L2VE
            </span>
          </Link>
          <div className="flex items-center space-x-2 text-xs">
            <Link to="/home" className={`${theme.textSecondary} hover:${theme.text} font-medium transition-colors`}>Projects</Link>
            <span className={theme.textMuted}>/</span>
            <Link to={`/project/${id}`} className={`${theme.textSecondary} hover:${theme.text} font-medium transition-colors`}>Dashboard</Link>
            <span className={theme.textMuted}>/</span>
            <Link to={`/project/${id}/scans`} className={`${theme.textSecondary} hover:${theme.text} font-medium transition-colors`}>Scans</Link>
            <span className={theme.textMuted}>/</span>
            <span className={`${isDark ? 'text-indigo-400' : 'text-indigo-600'} font-semibold`}>Analytics</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />

          <Link to="/mypage" className={`${theme.textSecondary} hover:${theme.text} text-xs font-medium transition-colors`}>
            My Page
          </Link>
          
          {user?.is_superuser && (
            <Link to="/admin" className={`${theme.textSecondary} hover:${theme.text} text-xs font-medium transition-colors`}>
              Admin
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}

export default DashboardHeader;

