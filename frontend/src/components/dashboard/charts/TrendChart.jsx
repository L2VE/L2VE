function TrendChart({ data, isDark, theme }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="flex items-end justify-between space-x-2 h-48">
      {data.map((item, idx) => {
        const total = item.critical + item.high + item.medium + item.low;
        const maxTotal = Math.max(...data.map(d => d.critical + d.high + d.medium + d.low), 1);
        const heightPercent = (total / maxTotal) * 100;
        
        return (
          <div key={idx} className="flex-1 flex flex-col items-center group">
            <div className="flex-1 flex flex-col justify-end w-full relative">
              <div
                className="w-full relative transition-all duration-500"
                style={{ height: `${heightPercent}%` }}
              >
                {/* Stacked bars */}
                {item.critical > 0 && (
                  <div className="w-full bg-red-500 rounded-t hover:opacity-80 transition-opacity" style={{ height: `${(item.critical / total) * 100}%` }} />
                )}
                {item.high > 0 && (
                  <div className="w-full bg-orange-500 hover:opacity-80 transition-opacity" style={{ height: `${(item.high / total) * 100}%` }} />
                )}
                {item.medium > 0 && (
                  <div className="w-full bg-yellow-500 hover:opacity-80 transition-opacity" style={{ height: `${(item.medium / total) * 100}%` }} />
                )}
                {item.low > 0 && (
                  <div className="w-full bg-green-500 rounded-b hover:opacity-80 transition-opacity" style={{ height: `${(item.low / total) * 100}%` }} />
                )}
              </div>
              
              {/* Hover tooltip */}
              <div className={`absolute -top-16 left-1/2 transform -translate-x-1/2 ${theme.cardBg} ${theme.border} rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10`}>
                <div className={`font-bold ${theme.text} mb-0.5`}>{item.date.slice(5)}</div>
                <div className="space-y-0.5">
                  {item.critical > 0 && <div className="text-red-400">C: {item.critical}</div>}
                  {item.high > 0 && <div className="text-orange-400">H: {item.high}</div>}
                  {item.medium > 0 && <div className="text-yellow-400">M: {item.medium}</div>}
                  {item.low > 0 && <div className="text-green-400">L: {item.low}</div>}
                </div>
              </div>
            </div>
            <div className={`mt-2 text-xs ${theme.textMuted} font-medium`}>{item.date.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default TrendChart;

