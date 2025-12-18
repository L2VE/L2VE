import { getScanEmptyStateMeta } from './scanEmptyStateMeta';

function ScanGridCard({ scan, isDark, statusBadgeClasses, formatDate, onOpenDetail }) {
  const renderStatusBadge = () => {
    const status = scan.status || '';
    if (!statusBadgeClasses[status]) return null;

    if (status === 'running') {
      return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses[status]}`}>
          <span className="relative flex h-2 w-2 mr-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
          </span>
          실행 중
        </span>
      );
    }

    const dotColor =
      status === 'completed'
        ? 'bg-emerald-500'
        : status === 'failed'
        ? 'bg-rose-500'
        : 'bg-yellow-500';

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses[status]}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColor}`}></span>
        {status === 'completed' && '완료됨'}
        {status === 'failed' && '실패'}
        {status === 'queued' && '대기 중'}
      </span>
    );
  };

  return (
    <div
      className={`rounded-2xl border p-6 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group hover:shadow-lg ${
        isDark
          ? 'bg-gray-800/60 border-gray-700/80 hover:border-gray-500 hover:bg-gray-800/70'
          : 'bg-white/95 border-gray-200 hover:border-indigo-300/80 hover:bg-white'
      }`}
    >
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100 group-hover:text-cyan-300' : 'text-gray-900 group-hover:text-indigo-900'} mb-2 transition-colors`}>
              {scan.name}
            </h3>
            <div className="flex items-center space-x-2">{renderStatusBadge()}</div>
          </div>
        </div>

        <div className="space-y-2 mb-4 text-sm">
          <div className="flex items-center justify-between">
            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>생성 시간</span>
            <span className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-medium`}>{formatDate(scan.created_at)}</span>
          </div>
          {scan.completed_at && (
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>완료 시간</span>
              <span className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-medium`}>{formatDate(scan.completed_at)}</span>
            </div>
          )}
        </div>

        <div className={`pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
          {scan.vulnerabilities_found > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>발견된 취약점</span>
                <span className={`text-2xl font-bold ${isDark ? 'bg-gradient-to-br from-amber-400 to-orange-400' : 'bg-gradient-to-br from-amber-600 to-orange-600'} bg-clip-text text-transparent`}>
                  {scan.vulnerabilities_found}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {scan.critical > 0 && (
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg ${isDark ? 'bg-rose-500/15 border-rose-400/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'} border`}> 
                    <span className="text-xs font-semibold">{scan.critical}</span>
                    <span className="text-xs">치명적</span>
                  </div>
                )}
                {scan.high > 0 && (
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg ${isDark ? 'bg-orange-500/15 border-orange-400/40 text-orange-300' : 'bg-orange-50 border-orange-200 text-orange-700'} border`}>
                    <span className="text-xs font-semibold">{scan.high}</span>
                    <span className="text-xs">높음</span>
                  </div>
                )}
                {scan.medium > 0 && (
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg ${isDark ? 'bg-amber-500/15 border-amber-400/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'} border`}>
                    <span className="text-xs font-semibold">{scan.medium}</span>
                    <span className="text-xs">중간</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            (() => {
              const meta = getScanEmptyStateMeta(scan.status);
              const palette = isDark ? meta.dark : meta.light;
              return (
                <div className="text-center py-3 space-y-1">
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full mx-auto ${palette.iconWrapper}`}>
                    <svg className={`w-5 h-5 ${palette.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={meta.iconPath} />
                    </svg>
                  </div>
                  <div className={`text-sm font-semibold ${palette.title}`}>{meta.title}</div>
                  <div className={`text-xs ${palette.subtitle}`}>{meta.subtitle}</div>
                </div>
              );
            })()
          )}
        </div>

        <button
          onClick={onOpenDetail}
          className={`w-full mt-4 px-4 py-2 font-medium rounded-lg border transition-all duration-300 flex items-center justify-center space-x-2 ${
            isDark
              ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 text-cyan-300 border-cyan-500/30 hover:border-cyan-400/50'
              : 'bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-900 border-indigo-200/50 hover:border-indigo-300'
          }`}
        >
          <span>상세 보기</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ScanGridCard;
