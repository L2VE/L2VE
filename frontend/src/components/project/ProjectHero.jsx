import React from 'react';

function ProjectHero({ isDark, project, onNewScan, onCreateReport }) {
  const description = project?.description || 'Secure project operations with real-time insights and beautiful analytics.';
  const isGitTrigger = project?.trigger_mode === 'git';
  const infoItems = isGitTrigger
    ? [
        {
          label: '연결된 Repository',
          value: project.git_url || '미설정',
          sub: `Branch: ${project.git_branch || 'main'}`,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7h2a2 2 0 012 2v0a2 2 0 01-2 2H3v5a2 2 0 002 2h12M15 7h4m0 0v4m0-4l-7 7"
              />
            </svg>
          ),
        },
        {
          label: 'Jenkins Job',
          value: project.jenkins_job_name || '자동 생성 예정',
          sub: project.jenkins_job_url ? (
            <a
              href={project.jenkins_job_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-400 hover:text-blue-200 underline"
            >
              {project.jenkins_job_url}
            </a>
          ) : (
            '프로비저닝 후 자동 연결'
          ),
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7H8m0 0l4-4m-4 4l4 4m0 6h8m0 0l-4 4m4-4l-4-4" />
            </svg>
          ),
        },
        {
          label: 'Webhook URL',
          value: project.webhook_url || '프로비저닝 후 제공',
          sub: project.webhook_secret ? `Secret: ${project.webhook_secret}` : 'Secret 미설정 (권장)',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
      ]
    : [];

  return (
    <div className={`relative overflow-hidden mb-8 rounded-3xl border ${isDark ? 'border-gray-700/70 bg-gray-800/80' : 'border-indigo-200/80 bg-white/90'} backdrop-blur-xl p-8`}>
      <div className={`absolute -top-12 -right-12 w-64 h-64 ${isDark ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10' : 'bg-gradient-to-br from-indigo-500/15 to-purple-500/15'} rounded-full blur-3xl`}></div>
      <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1">
          <h1 className={`text-4xl font-extrabold tracking-tight ${isDark ? 'bg-gradient-to-r from-gray-100 via-cyan-200 to-blue-200' : 'bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900'} bg-clip-text text-transparent`}>{project?.name}</h1>
          <p className={`mt-3 text-base ${isDark ? 'text-gray-400' : 'text-gray-600'} max-w-2xl`}>{description}</p>

          {infoItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              {infoItems.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border p-3 flex items-start gap-3 ${
                    isDark ? 'border-gray-700/60 bg-gray-900/40' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDark ? 'bg-gray-800 text-gray-100 border border-gray-700' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.label}</div>
                    <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>
                      {item.value}
                    </div>
                    {item.sub && (
                      <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {item.sub}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onNewScan}
            className="px-5 py-3 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
            style={{ backgroundColor: '#00326A' }}
            onMouseEnter={(e) => {
              if (onNewScan) e.currentTarget.style.backgroundColor = '#002355';
            }}
            onMouseLeave={(e) => {
              if (onNewScan) e.currentTarget.style.backgroundColor = '#00326A';
            }}
          >
            새 스캔
          </button>
          {/* <button
            onClick={onCreateReport}
            className="px-5 py-3 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
            style={{ backgroundColor: '#00326A' }}
            onMouseEnter={(e) => {
              if (onCreateReport) e.currentTarget.style.backgroundColor = '#002355';
            }}
            onMouseLeave={(e) => {
              if (onCreateReport) e.currentTarget.style.backgroundColor = '#00326A';
            }}
          >
            리포트 생성
          </button> */}
        </div>
      </div>
    </div>
  );
}

export default ProjectHero;
