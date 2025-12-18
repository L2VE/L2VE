import { useMemo, useState } from 'react';
import { SCAN_SORT_OPTIONS, severityMeta, SEVERITY_ORDER } from './scanDetailUtils';

function ScanDetailHeader({ selected, onClose, isDark, sortOption = 'severity', onSortChange, vulnerabilities = [], currentVulnIndex, onJumpToVuln }) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showJumpMenu, setShowJumpMenu] = useState(false);
  const surfaceClass = isDark
    ? 'bg-gray-900/90 border-gray-700 text-gray-100'
    : 'bg-white border-gray-200 text-gray-900';
  const secondaryText = isDark ? 'text-gray-400' : 'text-gray-600';
  const actionClass = isDark
    ? 'bg-gray-800 text-cyan-200 border-gray-600 hover:bg-gray-700'
    : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400';
  const currentSort = SCAN_SORT_OPTIONS.find((opt) => opt.key === sortOption) || SCAN_SORT_OPTIONS[0];
  const orderedVulns = useMemo(() => {
    const severityOrder = SEVERITY_ORDER;
    const orderMap = severityOrder.reduce((acc, key, idx) => ({ ...acc, [key]: idx }), {});
    const list = Array.isArray(vulnerabilities) ? [...vulnerabilities] : [];
    list.sort((a, b) => {
      const oA = orderMap[a.severity] ?? 99;
      const oB = orderMap[b.severity] ?? 99;
      if (oA !== oB) return oA - oB;
      const cweA = (a.cwe || '').toString();
      const cweB = (b.cwe || '').toString();
      if (cweA !== cweB) return cweA.localeCompare(cweB);
      const tA = (a.title || '').toString();
      const tB = (b.title || '').toString();
      return tA.localeCompare(tB);
    });
    return list;
  }, [vulnerabilities]);

  const handleSortSelect = (key) => {
    if (onSortChange) {
      onSortChange(key);
    }
    setShowSortMenu(false);
  };

  const currentVulnLabel = useMemo(() => {
    const current = orderedVulns.find((v) => v.originalIndex === currentVulnIndex);
    if (!current) return '취약점 바로가기';
    const sev = severityMeta[current.severity] || severityMeta.medium;
    return `${sev.label} · ${current.title}`;
  }, [orderedVulns, currentVulnIndex]);

  return (
    <div className={`scan-detail-header sticky top-0 px-8 py-5 flex items-center justify-between border-b ${surfaceClass}`}>
      <div>
        <h3
          className={`text-2xl font-bold bg-clip-text text-transparent ${
            isDark
              ? 'bg-gradient-to-r from-blue-200 via-cyan-200 to-emerald-200'
              : 'bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900'
          }`}
        >
          {selected.name || selected.scan_type || '스캔 결과'}
        </h3>
        <p className={`text-sm font-medium ${secondaryText}`}>
          상태: {selected.status} · ID: {selected.id}
        </p>
      </div>
      <div className="flex items-center space-x-3">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowJumpMenu((prev) => !prev);
            }}
            disabled={orderedVulns.length === 0}
            className={`flex items-center space-x-2 px-4 py-2.5 ${
              isDark ? 'bg-gray-800/90 border-gray-700 text-gray-200' : 'bg-white/90 border-gray-200/70 text-gray-800'
            } backdrop-blur-sm border rounded-xl text-sm font-medium ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50 hover:border-gray-300'
            } focus:outline-none transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10m-6 6h6" />
            </svg>
            <span className="truncate max-w-[220px]">{currentVulnLabel}</span>
            <svg
              className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'} transition-transform ${showJumpMenu ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showJumpMenu && (
            <div
              className={`absolute right-0 mt-2 w-96 max-h-80 overflow-y-auto ${
                isDark ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-gray-200/60'
              } backdrop-blur-xl rounded-xl shadow-2xl border py-2 z-50 animate-fade-in`}
            >
              {orderedVulns.map((v) => {
                const sevMeta = severityMeta[v.severity] || severityMeta.medium;
                const isActive = v.originalIndex === currentVulnIndex;
                return (
                  <button
                    key={`${v.originalIndex}-${v.cwe}`}
                    onClick={() => {
                      if (onJumpToVuln) onJumpToVuln(v.originalIndex);
                      setShowJumpMenu(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-start space-x-3 transition-colors ${
                      isActive
                        ? isDark
                          ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                          : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 font-semibold'
                        : isDark
                          ? 'text-gray-300 hover:bg-gray-700/50'
                          : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded ${
                      isDark ? sevMeta.darkBadge : sevMeta.badge
                    }`}>
                      {sevMeta.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{v.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{v.cwe}</div>
                    </div>
                    {isActive && (
                      <svg className="w-4 h-4 ml-auto text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selected.scan_results?.build_url && (
          <a
            href={selected.scan_results.build_url}
            target="_blank"
            rel="noreferrer"
            className={`px-4 py-2 text-sm font-semibold rounded-lg border-[2.5px] transition-all ${actionClass}`}
          >
            빌드 보기
          </a>
        )}
        {selected.scan_results?.artifact_url && (
          <a
            href={selected.scan_results.artifact_url}
            target="_blank"
            rel="noreferrer"
            className={`px-4 py-2 text-sm font-semibold rounded-lg border-[2.5px] transition-all ${actionClass}`}
          >
            결과 파일
          </a>
        )}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSortMenu((prev) => !prev);
            }}
            className={`flex items-center justify-between space-x-2 px-4 py-2.5 min-w-[160px] max-w-[160px] ${
              isDark ? 'bg-gray-800/90 border-gray-700 text-gray-200' : 'bg-white/90 border-gray-200/70 text-gray-800'
            } backdrop-blur-sm border rounded-xl text-sm font-medium ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50 hover:border-gray-300'
            } focus:outline-none transition-all duration-300 shadow-sm hover:shadow-md`}
          >
            <svg className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={currentSort.icon} />
            </svg>
            <span className="flex-1 truncate text-left">{currentSort.label}</span>
            <svg
              className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'} transition-transform ${showSortMenu ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSortMenu && (
            <div
              className={`absolute right-0 mt-2 w-48 ${
                isDark ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-gray-200/60'
              } backdrop-blur-xl rounded-xl shadow-2xl border py-2 z-50 animate-fade-in`}
            >
              {SCAN_SORT_OPTIONS.map((opt) => {
                const isActive = opt.key === sortOption;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSortSelect(opt.key)}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 transition-colors ${
                      isActive
                        ? isDark
                          ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                          : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 font-semibold'
                        : isDark
                          ? 'text-gray-300 hover:bg-gray-700/50'
                          : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={opt.icon} />
                    </svg>
                    <span>{opt.label}</span>
                    {isActive && (
                      <svg className="w-4 h-4 ml-auto text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ScanDetailHeader;
