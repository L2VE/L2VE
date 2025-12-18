function TimeFilter({ timeFilter, onFilterChange, isDark }) {
  return (
    <div className={`flex items-center space-x-1 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg p-1`}>
      {[7, 30].map(days => (
        <button
          key={days}
          onClick={() => onFilterChange(days)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            timeFilter === days
              ? 'bg-indigo-600 text-white'
              : `${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
          }`}
        >
          {days}일
        </button>
      ))}
    </div>
  );
}

export default TimeFilter;

