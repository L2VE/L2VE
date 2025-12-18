import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

/**
 * 프로젝트 페이지들의 공통 네비게이션 컴포넌트
 * - 일관된 한글 UI 제공
 * - ProjectDashboard, Scans, Findings, Reports, ScansDashboard 에서 공통 사용
 */
function ProjectNavigation({ 
  id,
  currentPage, // 'overview', 'scans', 'findings', 'reports', 'analytics'
  isDark, 
  setIsDark, 
  user, 
  handleLogout,
  projectName
}) {
  const navItems = [
    { key: 'overview', label: '개요', path: `/project/${id}` },
    { key: 'scans', label: '스캔', path: `/project/${id}/scans` },
    { key: 'findings', label: '발견사항', path: `/project/${id}/findings` },
    { key: 'reports', label: '리포트', path: `/project/${id}/reports` },
    { key: 'analytics', label: '분석', path: `/project/${id}/scans/dashboard` }
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 h-16 ${isDark ? 'bg-gray-800' : 'bg-white'} border-b-4 ${isDark ? 'border-blue-900' : 'border-blue-200'} shadow-sm z-50`}>
      <div className="px-6 h-full flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center space-x-8">
          <Link to="/home" className="flex items-center space-x-2.5 hover:opacity-80 transition-opacity">
            <img src="/images/logo.png" alt="L2VE" className="h-7 w-auto" />
            <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              L2VE
            </span>
          </Link>
          
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-xs">
            <Link to="/home" className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} font-medium transition-colors`}>
              프로젝트
            </Link>
            <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>/</span>
            {projectName ? (
              <>
                <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{projectName}</span>
                <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>/</span>
              </>
            ) : null}
            <span className={`${isDark ? 'text-indigo-400' : 'text-indigo-600'} font-semibold`}>
              {navItems.find(item => item.key === currentPage)?.label || currentPage}
            </span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {setIsDark && (
            <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
          )}

          <Link 
            to="/mypage" 
            className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} text-xs font-medium transition-colors`}
          >
            마이페이지
          </Link>
          
          {user?.is_superuser && (
            <Link 
              to="/admin" 
              className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} text-xs font-medium transition-colors`}
            >
              관리자
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="px-6 flex items-center space-x-1">
          {navItems.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                currentPage === item.key
                  ? `${isDark ? 'text-indigo-400' : 'text-indigo-600'} ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`
                  : `${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'}`
              }`}
            >
              {item.label}
              {currentPage === item.key && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${isDark ? 'bg-indigo-400' : 'bg-indigo-600'}`}></div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default ProjectNavigation;

