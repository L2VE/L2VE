import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';
import projectService from '../services/projectService';
import AppNavbar from '../components/common/AppNavbar';

function MyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    total_projects: 0,
    active_projects: 0,
    total_scans: 0,
    total_vulnerabilities: 0
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }

      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      await loadStats();
      await loadRecentProjects();
    };
    
    init();
  }, [navigate]);

  const loadStats = async () => {
    try {
      const data = await projectService.getProjectStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadRecentProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getProjects();
      setRecentProjects(data.slice(0, 5)); // 최근 5개만
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Animated Background Mesh Gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <AppNavbar
        user={user}
        handleLogout={handleLogout}
        breadcrumb={{
          items: [
            { label: '마이페이지' }
          ]
        }}
      />

      {/* Main Content */}
      <main className="pt-24 px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-10">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent mb-3">
              My Profile
            </h1>
            <p className="text-lg text-gray-600">계정 정보 및 활동 통계</p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column - Profile */}
            <div className="col-span-1">
              {/* Profile Card with 3D effect */}
              <div className="relative bg-white/90 backdrop-blur-sm border border-white/60 rounded-3xl p-8 mb-6 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-500 overflow-hidden group">
                {/* Gradient overlay */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                
                <div className="relative flex flex-col items-center">
                  {/* Avatar with gradient border */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-600 rounded-full blur-lg opacity-50 group-hover:opacity-70 transition-opacity"></div>
                    <div className="relative w-28 h-28 bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-600 rounded-full flex items-center justify-center ring-4 ring-white/50">
                      <span className="text-4xl font-bold text-white">
                        {user.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* User Info */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{user.full_name}</h2>
                  <p className="text-base text-gray-600 mb-1 font-medium">@{user.username}</p>
                  <p className="text-sm text-gray-500 mb-5">{user.email}</p>

                  {/* Status Badge with animation */}
                  <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200/50 rounded-full backdrop-blur-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    </span>
                    <span className="text-sm font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">Active</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">가입일</span>
                    <span className="text-gray-900 font-medium">
                      {new Date(user.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">마지막 로그인</span>
                    <span className="text-gray-900 font-medium">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString('ko-KR') : '처음'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">계정 타입</span>
                    <span className="text-gray-900 font-medium">
                      {user.is_superuser ? 'Admin' : 'User'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="relative bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl p-6 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <h3 className="relative text-base font-bold text-gray-900 mb-5">빠른 작업</h3>
                <div className="relative space-y-3">
                  <button className="w-full px-4 py-3 text-sm font-medium text-gray-700 hover:text-indigo-900 bg-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-xl border border-gray-200/50 hover:border-indigo-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 text-left flex items-center space-x-3 group/btn">
                    <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>비밀번호 변경</span>
                  </button>
                  <button className="w-full px-4 py-3 text-sm font-medium text-gray-700 hover:text-indigo-900 bg-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-xl border border-gray-200/50 hover:border-indigo-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 text-left flex items-center space-x-3 group/btn">
                    <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span>알림 설정</span>
                  </button>
                  <button className="w-full px-4 py-3 text-sm font-medium text-gray-700 hover:text-indigo-900 bg-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-xl border border-gray-200/50 hover:border-indigo-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 text-left flex items-center space-x-3 group/btn">
                    <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>보안 설정</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Stats & Activity */}
            <div className="col-span-2">
              {/* Stats Cards with Gradient */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="relative bg-gradient-to-br from-slate-50 to-indigo-50 backdrop-blur-sm border border-white/60 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-500/10 hover:-translate-y-1 transition-all duration-300 group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">총 프로젝트</p>
                    <p className="text-5xl font-bold bg-gradient-to-br from-slate-900 to-indigo-600 bg-clip-text text-transparent mb-2">{stats.total_projects}</p>
                    <p className="text-sm text-gray-600 font-medium">{stats.active_projects} active projects</p>
                  </div>
                </div>

                <div className="relative bg-gradient-to-br from-emerald-50 to-cyan-50 backdrop-blur-sm border border-white/60 rounded-2xl p-6 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">총 스캔</p>
                    <p className="text-5xl font-bold bg-gradient-to-br from-emerald-600 to-cyan-600 bg-clip-text text-transparent mb-2">{stats.total_scans}</p>
                    <p className="text-sm text-gray-600 font-medium">실행된 보안 스캔</p>
                  </div>
                </div>

                <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 backdrop-blur-sm border border-white/60 rounded-2xl p-6 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300 group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">발견된 취약점</p>
                    <p className="text-5xl font-bold bg-gradient-to-br from-amber-600 to-orange-600 bg-clip-text text-transparent mb-2">{stats.total_vulnerabilities}</p>
                    <p className="text-sm text-gray-600 font-medium">모든 프로젝트</p>
                  </div>
                </div>

                <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-sm border border-white/60 rounded-2xl p-6 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300 group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">평균 보안 점수</p>
                    <p className="text-5xl font-bold bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                      {stats.total_scans > 0 
                        ? Math.max(0, Math.min(100, Math.round(100 - (stats.total_vulnerabilities / stats.total_scans) * 20)))
                        : 100}
                    </p>
                    <p className="text-sm text-gray-600 font-medium">100점 만점</p>
                  </div>
                </div>
              </div>

              {/* Recent Projects */}
              <div className="relative bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl p-7 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-indigo-900 bg-clip-text text-transparent">최근 프로젝트</h3>
                  <Link to="/home" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 group">
                    <span>전체 보기</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                {recentProjects.length > 0 ? (
                  <div className="space-y-3">
                    {recentProjects.map((project) => (
                      <Link
                        key={project.id}
                        to={`/project/${project.id}`}
                        className="group flex items-center justify-between p-5 border border-gray-200/50 rounded-xl hover:border-indigo-200 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
                      >
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-gray-900 mb-1.5 group-hover:text-indigo-900">{project.name}</h4>
                          <p className="text-sm text-gray-500">
                            {project.description || 'No description'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-6 ml-6">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Scans</p>
                            <p className="text-lg font-bold bg-gradient-to-br from-emerald-600 to-cyan-600 bg-clip-text text-transparent">{project.total_scans}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Issues</p>
                            <p className="text-lg font-bold bg-gradient-to-br from-amber-600 to-orange-600 bg-clip-text text-transparent">{project.total_vulnerabilities}</p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">아직 생성된 프로젝트가 없습니다</p>
                    <Link to="/home" className="inline-block mt-4 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-shadow">
                      프로젝트 만들기
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default MyPage;

