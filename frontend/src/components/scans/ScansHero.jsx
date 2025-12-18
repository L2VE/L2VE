import { Link } from 'react-router-dom';

function ScansHero({ isDark, viewMode, setViewMode, projectId, onNewScan }) {
  return (
    <div className={`relative overflow-hidden mb-8 rounded-3xl border ${isDark ? 'border-gray-700/60 bg-gray-800/80' : 'border-white/60 bg-white/80'} backdrop-blur-xl p-8`}>
      <div className={`absolute -top-12 -right-12 w-64 h-64 ${isDark ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10' : 'bg-gradient-to-br from-indigo-500/15 to-purple-500/15'} rounded-full blur-3xl`}></div>
      <div className="relative flex items-start justify-between">
        <div>
          <h1 className={`text-4xl font-extrabold tracking-tight ${isDark ? 'bg-gradient-to-r from-gray-100 via-cyan-200 to-blue-200' : 'bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900'} bg-clip-text text-transparent`}>
            스캔
          </h1>
          <p className={`mt-3 text-base ${isDark ? 'text-gray-400' : 'text-gray-600'} max-w-2xl`}>
            모든 보안 스캔 관리 및 조회
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`flex items-center ${isDark ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-200'} backdrop-blur-sm border rounded-xl p-1 shadow-sm`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              title="카드 보기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              title="리스트 보기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* <Link
            to={`/project/${projectId}/scans/dashboard`}
            className={`px-5 py-3 ${isDark ? 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700 hover:border-gray-600' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50 hover:border-indigo-200'} font-semibold rounded-xl transition-all`}
          >
            대시보드
          </Link> */}

          <button
            onClick={onNewScan}
            className="px-5 py-3 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
            style={{ backgroundColor: '#00326A' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#002355';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#00326A';
            }}
          >
            새 스캔
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScansHero;

