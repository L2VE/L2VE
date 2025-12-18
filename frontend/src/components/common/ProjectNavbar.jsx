import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../../hooks/useTheme';

/**
 * 프로젝트 페이지들의 공통 네비게이션 (탭 메뉴 포함)
 * - ProjectDashboard, Scans, Findings, Reports에서 사용
 * - 프로젝트별 탭 네비게이션 제공
 * - 전역 다크모드 지원
 */
function ProjectNavbar({ 
  projectId,
  projectName,
  user, 
  handleLogout,
  triggerMode,
}) {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  
  const isActive = (path) => {
    if (path === `/project/${projectId}`) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const tabs = [
    {
      path: `/project/${projectId}`,
      label: '개요',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      path: `/project/${projectId}/scans`,
      label: '스캔',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      path: `/project/${projectId}/findings`,
      label: '취약점 관리',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    // {
    //   path: `/project/${projectId}/reports`,
    //   label: '리포트',
    //   icon: (
    //     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    //     </svg>
    //   )
    // }
  ];

  const basePath = `/project/${projectId}`;
  const activeTab =
    location.pathname === basePath
      ? null
      : tabs.find((tab) => tab.path !== basePath && location.pathname.startsWith(tab.path));

  const triggerLabel = (() => {
    if (triggerMode === 'git') return 'GIT';
    if (triggerMode === 'web') return 'WEB';
    return null;
  })();

  return (
    <nav className={`fixed top-0 left-0 right-0 backdrop-blur-xl ${isDark ? 'bg-gray-800/95' : 'bg-white/80'} border-b-4 ${isDark ? 'border-blue-900' : 'border-blue-200'} shadow-lg shadow-black/5 z-50 transition-colors`}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center space-x-8">
            <Link to="/home" className="flex items-center space-x-3 hover:opacity-90 transition-all group">
              <img src="/images/logo.png" alt="L2VE" className="h-8 w-auto group-hover:scale-110 transition-transform duration-300" />
              <span className={`text-xl font-bold ${isDark ? 'text-white' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent'}`}>
                L2VE
              </span>
            </Link>
            
            {/* Breadcrumb */}
            <div className="flex items-center gap-3 text-sm">
              <Link to="/home" className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} transition-colors`}>
                프로젝트
              </Link>
              <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>/</span>
              <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}>
                {projectName}
              </span>
              {activeTab && (
                <>
                  <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>/</span>
                  <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {activeTab.label}
                  </span>
                </>
              )}
              {triggerLabel && (
                <span className="ml-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-600 border border-cyan-500/30">
                  {triggerLabel}
                </span>
              )}
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            {/* 다크모드 토글 */}
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
        
        {/* Tab Navigation */}
        <div className={`flex items-center space-x-2 mt-4 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200/50'} pt-4`}>
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive(tab.path)
                  ? isDark 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : isDark
                    ? 'text-gray-300 hover:bg-gray-700/50 border border-transparent'
                    : 'text-gray-700 hover:bg-gray-50 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default ProjectNavbar;


