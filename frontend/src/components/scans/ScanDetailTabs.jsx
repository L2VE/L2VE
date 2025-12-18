const TABS = [
  { id: 'summary', label: '결과' },
  { id: 'patch', label: '패치' },
  { id: 'pipeline', label: '파이프라인' },
  { id: 'details', label: '기타' },
];

function ScanDetailTabs({ activeTab, onChange, isDark }) {
  const baseBorder = isDark ? 'border-gray-700/70' : 'border-gray-300';
  return (
    <div className={`scan-detail-tabs border-b-[3px] ${baseBorder} px-8 flex space-x-1`}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const activeClass = isDark
          ? 'text-cyan-200 border-cyan-300'
          : 'text-indigo-700 border-indigo-600';
        const inactiveClass = isDark
          ? 'text-gray-400 hover:text-gray-200'
          : 'text-gray-600 hover:text-gray-800';
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-5 py-3.5 text-sm font-semibold transition-all border-b-[3px] ${
              isActive ? activeClass : `${inactiveClass} border-transparent`
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default ScanDetailTabs;
