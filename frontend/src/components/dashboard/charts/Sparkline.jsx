function Sparkline({ data, isDark, theme }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="flex items-end justify-between space-x-1 h-10">
      {data.map((item, idx) => {
        const maxScans = Math.max(...data.map(d => d.scans), 1);
        const height = Math.max((item.scans / maxScans) * 100, 5);
        return (
          <div
            key={idx}
            className={`flex-1 ${isDark ? 'bg-gradient-to-t from-blue-600 to-cyan-500' : 'bg-gradient-to-t from-purple-600 to-pink-500'} rounded-t opacity-70 hover:opacity-100 transition-all duration-300 group/bar relative`}
            style={{ height: `${height}%` }}
          >
            <div className={`absolute -top-6 left-1/2 transform -translate-x-1/2 ${theme.cardBg} ${theme.border} rounded px-1 py-0.5 text-xs font-bold ${theme.text} opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none`}>
              {item.scans}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Sparkline;

