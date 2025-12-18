import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../../hooks/useTheme';

/**
 * 전체 앱의 공통 상단 네비게이션 바
 * - Home, ProjectDashboard, Scans, Findings, Reports, ScansDashboard 등 모든 페이지에서 공통 사용
 * - 일관된 높이(h-16), 로고 크기(h-8), 스타일 통일
 * - 전역 다크모드 지원
 */
function AppNavbar({ 
  user, 
  handleLogout,
  breadcrumb // { items: [{ label: '프로젝트', to: '/home' }, { label: 'Project Name' }] }
}) {
  const { isDark, toggleTheme } = useTheme();
  return (
    <nav className={`fixed top-0 left-0 right-0 h-16 backdrop-blur-xl ${isDark ? 'bg-gray-800/95' : 'bg-white/80'} border-b-4 ${isDark ? 'border-blue-900' : 'border-blue-200'} shadow-lg shadow-black/5 z-50 transition-colors`}>
      <div className="px-6 h-full flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center space-x-8">
          <Link to="/home" className="flex items-center space-x-3 hover:opacity-90 transition-all group">
            <img src="/images/logo.png" alt="L2VE" className="h-8 w-auto group-hover:scale-110 transition-transform duration-300" />
            <span className={`text-xl font-bold ${isDark ? 'text-white' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent'}`}>
              L2VE
            </span>
          </Link>
          
          {/* Breadcrumb */}
          {breadcrumb && breadcrumb.items && breadcrumb.items.length > 0 && (
            <div className="flex items-center space-x-2 text-sm">
              {breadcrumb.items.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  {item.to ? (
                    <Link 
                      to={item.to} 
                      className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{item.label}</span>
                  )}
                  {index < breadcrumb.items.length - 1 && (
                    <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>/</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* 다크모드 토글 - 모든 페이지에서 사용 */}
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

          {user?.is_superuser && (
            <Link 
              to="/admin" 
              className={`text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'} transition-colors flex items-center space-x-1`}
              title="관리자"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>관리자</span>
            </Link>
          )}

          <Link to="/settings" className={`text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'} transition-colors`}>
            설정
          </Link>

          <button
            onClick={handleLogout}
            className={`text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  );
}

export default AppNavbar;

