import React from 'react';
import CircularProgress from './charts/CircularProgress';

function MetricCard({ type, data, theme, isDark }) {
  // Risk Score Card
  if (type === 'risk') {
    const { riskScore, riskLevel, totalScans, totalVulnerabilities } = data;
    
    return (
      <div className={`col-span-3 ${theme.cardBg} border ${theme.border} rounded-lg p-5 ${theme.shadow} shadow-sm hover:shadow-md hover:${theme.borderHover} transition-all duration-500 group relative overflow-hidden`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${riskLevel.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider mb-1`}>Security Risk</p>
              <p className={`text-xs ${theme.textSecondary} font-medium`}>Overall threat level</p>
            </div>
            <div className={`px-3 py-1.5 rounded-lg ${riskLevel.textColor} ${isDark ? 'bg-slate-700/50' : 'bg-white/50'} text-xs font-black shadow-md`}>
              {riskLevel.label}
            </div>
          </div>

          <div className="flex items-center justify-center mb-4 relative">
            <CircularProgress 
              score={riskScore} 
              isDark={isDark}
              strokeColor={
                riskScore >= 75 ? (isDark ? '#ef4444' : '#dc2626') :
                riskScore >= 50 ? (isDark ? '#f97316' : '#ea580c') :
                riskScore >= 25 ? (isDark ? '#eab308' : '#ca8a04') :
                (isDark ? '#22c55e' : '#16a34a')
              }
            />
            
            <div className="relative z-10 text-center">
              <div className={`text-5xl font-black ${theme.text} leading-none`}>{riskScore}</div>
              <div className={`text-xs ${theme.textSecondary} font-semibold mt-1`}>out of 100</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className={`${isDark ? 'bg-slate-700/30' : 'bg-white/50'} rounded-lg p-2 text-center`}>
              <div className={`text-xs ${theme.textMuted} mb-1`}>Scan 수</div>
              <div className={`text-lg font-black ${theme.text}`}>{totalScans}</div>
            </div>
            <div className={`${isDark ? 'bg-slate-700/30' : 'bg-white/50'} rounded-lg p-2 text-center`}>
              <div className={`text-xs ${theme.textMuted} mb-1`}>Findings</div>
              <div className={`text-lg font-black ${riskLevel.textColor}`}>{totalVulnerabilities}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Total Scans Card
  if (type === 'scans') {
    const { totalScans, completedScans, runningScans, failedScans, timelineData } = data;
    
    return (
      <div className={`col-span-3 ${theme.cardBg} border ${theme.border} rounded-lg p-4 ${theme.shadow} shadow-sm hover:shadow-md hover:scale-[1.02] hover:${theme.borderHover} transition-all duration-400 group relative overflow-hidden`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${isDark ? 'from-blue-500/5' : 'from-purple-500/10'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider mb-2`}>전체 Scan 수</p>
              <div className="flex items-baseline space-x-2">
                <div className={`text-4xl font-black ${theme.text}`}>{totalScans}</div>
                <div className={`text-xs ${theme.textSecondary} font-semibold`}>
                  {completedScans > 0 && totalScans > 0 ? `${Math.round((completedScans / totalScans) * 100)}%` : '0%'} done
                </div>
              </div>
            </div>
            <div className={`p-3 ${isDark ? 'bg-blue-500/20' : 'bg-purple-500/20'} rounded-lg transition-transform`}>
              <svg className={`w-6 h-6 ${theme.accentText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { label: 'Done', value: completedScans, color: 'green' },
              { label: 'Running', value: runningScans, color: 'yellow' },
              { label: 'Failed', value: failedScans, color: 'red' }
            ].map((item, idx) => (
              <div key={idx} className={`text-center p-1.5 ${isDark ? 'bg-slate-700/30' : 'bg-white/40'} rounded transition-all hover:scale-105`}>
                <div className={`text-sm font-black text-${item.color}-${isDark ? '400' : '600'}`}>{item.value}</div>
                <div className={`text-xs ${theme.textMuted} mt-0.5`}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-end justify-between space-x-1 h-10">
            {timelineData.slice(-12).map((data, idx) => {
              const maxScans = Math.max(...timelineData.map(d => d.scans), 1);
              const height = Math.max((data.scans / maxScans) * 100, 5);
              return (
                <div
                  key={idx}
                  className={`flex-1 ${isDark ? 'bg-gradient-to-t from-blue-600 to-cyan-500' : 'bg-gradient-to-t from-purple-600 to-pink-500'} rounded-t opacity-70 hover:opacity-100 transition-all duration-300 group/bar relative`}
                  style={{ height: `${height}%` }}
                >
                  <div className={`absolute -top-6 left-1/2 transform -translate-x-1/2 ${theme.cardBg} ${theme.border} rounded px-1 py-0.5 text-xs font-bold ${theme.text} opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none`}>
                    {data.scans}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Vulnerabilities Card
  if (type === 'vulnerabilities') {
    const { totalVulnerabilities, vulnStats } = data;
    
    return (
      <div className={`col-span-3 ${theme.cardBg} border ${theme.border} rounded-lg p-4 ${theme.shadow} shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-red-500/30 transition-all duration-400 group relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider mb-2`}>취약점</p>
              <div className="flex items-baseline space-x-2">
                <div className={`text-4xl font-black ${theme.text}`}>{totalVulnerabilities}</div>
                <div className={`text-xs ${theme.textSecondary} font-semibold`}>found</div>
              </div>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg transition-all">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { label: 'Critical', value: vulnStats.critical, total: totalVulnerabilities, barColor: isDark ? '#ef4444' : '#dc2626', bgDark: 'bg-red-500/20', bgLight: 'bg-red-50', textColorDark: 'text-red-400', textColorLight: 'text-red-700' },
              { label: 'High', value: vulnStats.high, total: totalVulnerabilities, barColor: isDark ? '#f97316' : '#ea580c', bgDark: 'bg-orange-500/20', bgLight: 'bg-orange-50', textColorDark: 'text-orange-400', textColorLight: 'text-orange-700' },
              { label: 'Medium', value: vulnStats.medium, total: totalVulnerabilities, barColor: isDark ? '#eab308' : '#ca8a04', bgDark: 'bg-yellow-500/20', bgLight: 'bg-yellow-50', textColorDark: 'text-yellow-400', textColorLight: 'text-yellow-700' },
              { label: 'Low', value: vulnStats.low, total: totalVulnerabilities, barColor: isDark ? '#22c55e' : '#16a34a', bgDark: 'bg-green-500/20', bgLight: 'bg-green-50', textColorDark: 'text-green-400', textColorLight: 'text-green-700' }
            ].map((item, idx) => {
              const percentage = item.total > 0 ? (item.value / item.total * 100) : 0;
              return (
                <div key={idx} className="flex items-center space-x-2">
                  <div className={`flex-shrink-0 w-16 ${isDark ? item.bgDark : item.bgLight} rounded px-2 py-1 text-center`}>
                    <div className={`text-xs font-bold ${isDark ? item.textColorDark : item.textColorLight}`}>{item.label}</div>
                  </div>
                  <div className={`flex-1 h-2.5 ${isDark ? 'bg-slate-700/50' : 'bg-gray-300'} rounded-full overflow-hidden shadow-inner`}>
                    <div 
                      className="h-full rounded-full transition-all duration-800 ease-out"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: item.barColor
                      }} 
                    />
                  </div>
                  <div className={`flex-shrink-0 w-8 text-xs font-black ${isDark ? item.textColorDark : item.textColorLight} text-right`}>
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Avg Scan Time Card
  if (type === 'scanTime') {
    const { avgScanTime, peakHour } = data;
    
    return (
      <div className={`col-span-3 ${theme.cardBg} border ${theme.border} rounded-lg p-4 ${theme.shadow} shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-cyan-500/30 transition-all duration-400 group relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider mb-2`}>평균 Scan 시간</p>
              <div className="flex items-baseline space-x-1.5">
                <div className={`text-4xl font-black ${theme.text}`}>{avgScanTime}</div>
                <div className={`text-lg font-bold ${theme.textSecondary}`}>sec</div>
              </div>
            </div>
            <div className={`p-3 ${isDark ? 'bg-cyan-500/20' : 'bg-blue-500/20'} rounded-lg transition-transform`}>
              <svg className={`w-6 h-6 ${isDark ? 'text-cyan-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-700/30' : 'bg-white/50'} rounded-lg p-3 mb-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className={`text-xs ${theme.textSecondary} font-semibold`}>Peak Hour</span>
              </div>
              <div className={`text-lg font-black ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
                {peakHour}:00
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-700/30' : 'bg-white/50'} rounded-lg p-2.5`}>
            <div className="flex items-center justify-between text-xs">
              <span className={theme.textMuted}>효율성</span>
              <span className={`font-bold ${avgScanTime < 30 ? 'text-green-500' : avgScanTime < 60 ? 'text-yellow-500' : 'text-orange-500'}`}>
                {avgScanTime < 30 ? 'Excellent' : avgScanTime < 60 ? 'Good' : 'Average'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default MetricCard;

