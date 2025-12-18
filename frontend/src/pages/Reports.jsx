import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';
import projectService from '../services/projectService';
import reportService from '../services/reportService';
import ProjectNavbar from '../components/common/ProjectNavbar';
import { useTheme } from '../hooks/useTheme';

function Reports() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [project, setProject] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  useEffect(() => {
    const init = async () => {
      const isAuth = await authService.isAuthenticated();
      if (!isAuth) {
        navigate('/login');
        return;
      }

      // Load user data
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      try {
        setLoading(true);
        try {
          const projectData = await projectService.getProject(id);
          if (projectData) {
            setProject(projectData);
            setProjectName(projectData.name);
          }
        } catch (projectError) {
          console.error('Failed to load project metadata:', projectError);
        }

        const list = await reportService.getReports(id);
        setReports(list || []);

        if (!projectName && list && list.length > 0 && list[0].project_name) {
          setProjectName(list[0].project_name);
        }
      } catch (e) {
        setError(typeof e === 'string' ? e : (e?.response?.data?.detail || '리포트 목록을 불러오지 못했습니다.'));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, navigate]);

  const getReportTypeBadge = (type) => {
    const styles = {
      monthly: 'bg-blue-50 text-blue-700 border-blue-200',
      vulnerability: 'bg-rose-50 text-rose-700 border-rose-200',
      compliance: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      custom: 'bg-gray-50 text-gray-700 border-gray-200'
    };

    const labels = {
      monthly: '월간',
      vulnerability: '취약점',
      compliance: '컴플라이언스',
      custom: '사용자 지정'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${styles[type]}`}>
        {labels[type]}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formLabelClass = `block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`;
  const formInputClass = `w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${isDark
    ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 focus:ring-cyan-500 focus:border-cyan-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500'
    }`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800' : 'bg-[#EAF2FF]'}`}>
      {isDark ? (
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
        </div>
      ) : (
        <div className="fixed inset-0 -z-10 bg-[#EAF2FF]" />
      )}

      <ProjectNavbar
        projectId={id}
        projectName={projectName || '프로젝트'}
        user={user}
        handleLogout={handleLogout}
        triggerMode={project?.trigger_mode}
      />

      {/* Main Content */}
      <main className="pt-36 px-8 pb-10">
        <div className="max-w-[1400px] mx-auto">
          {/* Hero Header */}
          <div className={`relative overflow-hidden mb-8 rounded-3xl border ${isDark ? 'border-gray-700/60 bg-gray-800/80' : 'border-white/60 bg-white/80'} backdrop-blur-xl p-8`}>
            <div className={`absolute -top-12 -right-12 w-64 h-64 ${isDark ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10' : 'bg-gradient-to-br from-indigo-500/15 to-purple-500/15'} rounded-full blur-3xl`}></div>
            <div className="relative flex items-start justify-between">
              <div>
                <h1 className={`text-4xl font-extrabold tracking-tight ${isDark ? 'bg-gradient-to-r from-gray-100 via-cyan-200 to-blue-200' : 'bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900'} bg-clip-text text-transparent`}>리포트</h1>
                <p className={`mt-3 text-base ${isDark ? 'text-gray-400' : 'text-gray-600'} max-w-2xl`}>보안 리포트 조회 및 생성</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-3 text-white font-semibold rounded-xl shadow-lg transition-all"
                style={{ backgroundColor: '#00326A', boxShadow: '0 10px 15px -3px rgba(0, 50, 106, 0.3)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#002355'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00326A'}
              >
                리포트 생성
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-sm">{error}</div>
          )}

          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-1 gap-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-28 ${isDark ? 'bg-gray-800/50 border-gray-700/60' : 'bg-white/70 border-white/60'} rounded-2xl border animate-pulse`} />
              ))}
            </div>
          )}

          {/* Reports Grid - Awwwards Style */}
          <div className="grid grid-cols-1 gap-5">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`relative ${isDark ? 'bg-gray-800/70 border-gray-700 hover:border-gray-600 hover:shadow-cyan-500/10' : 'bg-white/90 border-white/60 hover:shadow-indigo-500/10'} backdrop-blur-sm border rounded-2xl p-7 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 cursor-pointer group overflow-hidden`}
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>

                <div className="relative flex items-start space-x-5">
                  <div className="flex-shrink-0 w-16 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center border-2 border-indigo-200/50 group-hover:border-indigo-300 group-hover:scale-110 transition-all duration-300">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className={`text-xl font-bold ${isDark ? 'text-gray-100 group-hover:text-cyan-300' : 'text-gray-900 group-hover:text-indigo-900'} transition-colors`}>
                        {report.title}
                      </h3>
                      {getReportTypeBadge(report.type)}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">{formatDate(report.created_at)}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="font-medium">{report.scan_count}개 스캔</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-semibold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                          {report.vulnerabilities_found}개 이슈
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300 flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>리포트 보기</span>
                      </button>
                      <button className={`px-4 py-2 ${isDark ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border-gray-700 hover:border-gray-600' : 'bg-white text-gray-700 hover:text-indigo-900 hover:bg-gray-50 border-gray-200 hover:border-indigo-200'} font-medium rounded-lg border transition-all duration-300 flex items-center space-x-2`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>PDF 다운로드</span>
                      </button>
                      <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Create Report Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
          <div className={`${isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'} rounded-lg shadow-xl max-w-lg w-full`}>
            <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>리포트 생성</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={formLabelClass}>리포트 제목</label>
                <input
                  type="text"
                  placeholder="예: 월간 보안 리포트"
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>리포트 유형</label>
                <select className={formInputClass}>
                  <option>월간 요약</option>
                  <option>취약점 평가</option>
                  <option>컴플라이언스 리포트</option>
                  <option>사용자 지정 리포트</option>
                </select>
              </div>
              <div>
                <label className={formLabelClass}>기간</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    className={formInputClass}
                  />
                  <input
                    type="date"
                    className={formInputClass}
                  />
                </div>
              </div>
            </div>

            <div className={`px-6 py-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border-t flex justify-end space-x-3`}>
              <button
                onClick={() => setShowCreateModal(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${isDark
                  ? 'text-gray-200 bg-gray-800/70 border border-gray-600 hover:bg-gray-700/70'
                  : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                취소
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${isDark
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-500 text-white'
                  : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;

