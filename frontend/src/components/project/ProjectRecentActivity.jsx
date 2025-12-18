import React from 'react';
import { Link } from 'react-router-dom';
import { cardClass, softCardClass, mutedText } from '../../utils/themeStyles';

function ProjectRecentActivity({
  isDark,
  scans,
  projectId,
  statusBadgeClasses,
  formatDate,
  activityFeed,
  activityIconStyles,
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
      <div className={`xl:col-span-2 ${cardClass(isDark, 'p-6 hover:shadow-lg transition-shadow border-gray-300', 'p-6 hover:border-gray-600 hover:shadow-cyan-500/10')}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>최근 스캔</h3>
          <Link
            to={`/project/${projectId || ''}/scans`}
            className={`text-xs font-medium ${isDark ? 'text-cyan-300 hover:text-cyan-200' : 'text-indigo-600 hover:text-indigo-800'}`}
          >
            전체 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(scans || []).length === 0 ? (
            <div className="col-span-2">
              <div className={`h-48 ${isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-300'} rounded-xl border flex flex-col items-center justify-center`}>
                <svg className={`w-12 h-12 ${isDark ? 'text-gray-600' : 'text-gray-300'} mb-3`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>아직 발견된 취약점이 없습니다</p>
                <p className={`text-xs mt-1 ${mutedText(isDark)}`}>스캔을 실행하여 보안 이슈를 확인하세요</p>
              </div>
            </div>
          ) : (
            (scans || []).slice(0, 4).map((scan) => (
              <div
                key={scan.id}
                className={softCardClass(
                  isDark,
                  'p-4 hover:shadow-md transition-all duration-300 group overflow-hidden border border-gray-300',
                  'p-4 hover:border-gray-600 hover:shadow-cyan-500/10 group overflow-hidden border border-gray-700 bg-gray-900/30'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                        isDark
                      ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200'
                      : 'bg-cyan-50 border-cyan-300 text-cyan-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 2a1 1 0 011-1h4a1 1 0 011 1v1h2a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h2V2zm2 0h2v1h-2V2zm-3 5h8m-8 4h8m-8 4h5"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{scan.name}</h4>
                      <div className={`text-[11px] ${mutedText(isDark)}`}>{formatDate(scan.completed_at)}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${mutedText(isDark, 'text-gray-400', 'text-gray-500')}`}>#{scan.id}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className={`text-[10px] font-semibold uppercase ${mutedText(isDark)}`}>취약점</div>
                    <div className={`text-xl font-black ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                      {(scan.critical || 0) + (scan.high || 0) + (scan.medium || 0) + (scan.low || 0)}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`flex items-center space-x-1 text-[10px] font-bold ${isDark ? 'text-rose-300' : 'text-rose-500'}`}>
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                        <span>위험 {scan.critical || 0}</span>
                      </span>
                      <span className={`flex items-center space-x-1 text-[10px] font-bold ${isDark ? 'text-orange-300' : 'text-orange-500'}`}>
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                        <span>높음 {scan.high || 0}</span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className={`text-[10px] font-semibold uppercase ${mutedText(isDark)}`}>상태</div>
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg inline-flex items-center space-x-1 ${statusBadgeClasses[scan.status] || ''}`}>
                      <span>{scan.status}</span>
                    </span>
                    <div className={`text-[10px] font-semibold uppercase mt-3 ${mutedText(isDark)}`}>소요 시간</div>
                    <div className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{scan.duration}</div>
                  </div>
                </div>
                <button
                  className={`mt-4 w-full text-xs font-semibold rounded-lg py-2 transition-colors ${
                    isDark
                      ? 'text-cyan-300 hover:text-cyan-200 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                      : 'text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300'
                  }`}
                >
                  상세 보기
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={cardClass(isDark, 'p-6 hover:shadow-lg transition-shadow border-gray-300', 'p-6 hover:border-gray-600 hover:shadow-cyan-500/10')}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>활동</h3>
          <button className={`text-xs font-medium ${mutedText(isDark, 'text-gray-500 hover:text-gray-900', 'text-gray-400 hover:text-gray-200')}`}>새로고침</button>
        </div>
        <div className="space-y-4">
          {activityFeed.length === 0 && (
            <div className={`h-48 ${isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-300'} rounded-xl border flex flex-col items-center justify-center`}>
              <svg className={`w-12 h-12 ${isDark ? 'text-gray-600' : 'text-gray-300'} mb-3`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c1.886 0 3.676.668 5.086 1.885a.75.75 0 01.028 1.126L15 13l2.114 1.989a.75.75 0 01-.028 1.126A8.953 8.953 0 0112 18a8.953 8.953 0 01-5.086-1.885.75.75 0 01-.028-1.126L9 13l-2.114-1.989a.75.75 0 01.028-1.126A8.953 8.953 0 0112 8z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 16v-2m10-6h-2M4 12H2m15.07 6.07l-1.414-1.414M8.343 8.343L6.929 6.929m0 10.142l1.414-1.414m9.9-7.728l-1.414 1.414" />
              </svg>
              <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>활동 로그가 없습니다</p>
              <p className={`text-xs mt-1 ${mutedText(isDark)}`}>프로젝트에서 아직 기록된 활동이 없어요</p>
            </div>
          )}
          {activityFeed.map((activity) => {
            const iconCfg = activityIconStyles[activity.status] || activityIconStyles.default;
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconCfg.bg}`}>
                  <svg className={`w-4 h-4 ${iconCfg.text || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconCfg.path} />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{activity.title}</p>
                    <span className={`text-[10px] ${mutedText(isDark, 'text-gray-400', 'text-gray-500')}`}>{activity.timeAgo}</span>
                  </div>
                  <p className={`text-xs mt-1 ${mutedText(isDark)}`}>{activity.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ProjectRecentActivity;
