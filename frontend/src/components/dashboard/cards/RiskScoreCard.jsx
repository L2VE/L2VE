import CircularProgress from '../charts/CircularProgress';

function RiskScoreCard({ riskScore, riskLevel, totalScans, totalVulnerabilities, isDark, theme }) {
  const circleColor = 
    riskScore >= 75 ? (isDark ? '#ef4444' : '#dc2626') :
    riskScore >= 50 ? (isDark ? '#f97316' : '#ea580c') :
    riskScore >= 25 ? (isDark ? '#eab308' : '#ca8a04') :
    (isDark ? '#22c55e' : '#16a34a');

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

        {/* Big Score with Circular Background */}
        <div className="flex items-center justify-center mb-4 relative">
          <CircularProgress 
            value={riskScore}
            maxValue={100}
            size={140}
            strokeWidth={12}
            color={circleColor}
            isDark={isDark}
          />
          
          {/* Score Number */}
          <div className="absolute z-10 text-center">
            <div className={`text-5xl font-black ${theme.text} leading-none`}>{riskScore}</div>
            <div className={`text-xs ${theme.textSecondary} font-semibold mt-1`}>out of 100</div>
          </div>
        </div>

        {/* Compact Stats */}
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

export default RiskScoreCard;

