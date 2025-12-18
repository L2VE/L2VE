import React from 'react';
import { cardClass, mutedText } from '../../utils/themeStyles';

function ProjectTaintFlowSummary({ isDark, taintFlow }) {
  const sources = taintFlow?.sources ?? 0;
  const propagations = taintFlow?.propagations ?? 0;
  const sinks = taintFlow?.sinks ?? 0;
  const topPaths = Array.isArray(taintFlow?.top_paths) ? taintFlow.top_paths : [];
  const hasData = sources + propagations + sinks > 0 || topPaths.length > 0;

  const cards = [
    {
      label: 'Source',
      count: sources,
      description: '신뢰되지 않은 데이터 유입 지점',
      container: {
        light: 'bg-white border-indigo-300',
        dark: 'bg-gray-900/30 border-gray-700',
      },
      valueColor: {
        light: 'text-blue-600',
        dark: 'text-blue-300',
      },
      icon: {
        light: 'bg-gradient-to-br from-white via-indigo-50 to-indigo-100 border-indigo-300 text-indigo-600 shadow-[0_10px_18px_rgba(79,70,229,0.18)]',
        dark: 'bg-gradient-to-br from-indigo-500/25 via-indigo-500/10 to-indigo-500/5 border-indigo-400/60 text-indigo-200 ring-1 ring-indigo-400/40 backdrop-blur-sm shadow-lg shadow-indigo-500/10',
      },
      iconPath: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    },
    {
      label: 'Propagation',
      count: propagations,
      description: '검증 없이 전달된 경로',
      container: {
        light: 'bg-white border-indigo-300',
        dark: 'bg-gray-900/30 border-gray-700',
      },
      valueColor: {
        light: 'text-purple-600',
        dark: 'text-purple-300',
      },
      icon: {
        light: 'bg-purple-100 border-purple-300 text-purple-600',
        dark: 'bg-purple-500/15 border-purple-400/40 text-purple-200',
      },
      iconPath: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
    },
    {
      label: 'Sink',
      count: sinks,
      description: '위험 작업 실행 지점',
      container: {
        light: 'bg-white border-indigo-300',
        dark: 'bg-gray-900/30 border-gray-700',
      },
      valueColor: {
        light: 'text-rose-600',
        dark: 'text-rose-300',
      },
      icon: {
        light: 'bg-rose-100 border-rose-300 text-rose-600',
        dark: 'bg-rose-500/15 border-rose-400/40 text-rose-200',
      },
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    },
  ];

  return (
    <div className={`${cardClass(isDark, 'p-6 hover:shadow-lg transition-shadow mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-gray-300', 'p-6 hover:border-gray-600 hover:shadow-cyan-500/10 mb-6 bg-gradient-to-br from-gray-900/40 to-gray-800/40')}`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Taint Flow 분석 요약</h3>
          <p className={`text-xs ${mutedText(isDark)} mt-1`}>Source → Propagation → Sink 흐름 분석</p>
        </div>
        <div className={`px-3 py-1.5 ${isDark ? 'bg-gray-800 border-gray-600 text-cyan-300' : 'bg-white border-indigo-300 text-indigo-600'} rounded-lg border`}>
          <span className="text-xs font-semibold">최근 스캔 기준</span>
        </div>
      </div>

      {hasData ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className={`${cardClass(isDark, 'p-4 hover:shadow-md transition-all group border-gray-300', 'p-4 hover:border-gray-600 hover:shadow-cyan-500/10 group')} ${isDark ? card.container.dark : card.container.light}`}
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${isDark ? card.icon.dark : card.icon.light}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.iconPath} />
                    </svg>
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${mutedText(isDark, 'text-gray-600', 'text-gray-300')}`}>{card.label}</div>
                    <div className={`text-2xl font-black ${isDark ? card.valueColor.dark : card.valueColor.light}`}>{card.count}</div>
                  </div>
                </div>
                <p className={`text-xs ${mutedText(isDark)}`}>{card.description}</p>
              </div>
            ))}
          </div>

          {topPaths.length > 0 && (
            <div className={`${cardClass(isDark, 'p-4 border border-indigo-300 bg-white', 'p-4 border border-gray-700 bg-gray-900/40')} rounded-xl`}>
              <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>주요 위험 경로</h4>
              <div className="space-y-3">
                {topPaths.slice(0, 5).map((path, index) => (
                  <div key={`${path.source}-${path.sink}-${index}`} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-indigo-50 border-indigo-200'} border rounded-lg px-3 py-2`}>
                    <div>
                      <p className={`text-xs font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        {path.source} → {path.sink}
                      </p>
                      {path.description && (
                        <p className={`text-xs mt-1 leading-snug ${mutedText(isDark)}`}>{path.description}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded ${
                      path.risk === 'critical'
                        ? 'bg-rose-100 text-rose-700'
                        : path.risk === 'high'
                        ? 'bg-orange-100 text-orange-700'
                        : path.risk === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                    >
                      {path.risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={`h-32 ${isDark ? 'bg-gray-900/40 border-gray-700' : 'bg-white border-indigo-300'} rounded-xl flex flex-col items-center justify-center`}>
          <svg className={`w-12 h-12 ${isDark ? 'text-cyan-300' : 'text-indigo-300'} mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className={`text-sm ${mutedText(isDark)}`}>Taint Flow 데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
}

export default ProjectTaintFlowSummary;
