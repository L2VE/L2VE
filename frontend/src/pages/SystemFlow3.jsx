import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

const actors = [
  { id: 'user', label: 'User', emoji: '👤', desc: 'Security analyst / developer' },
  { id: 'frontend', label: 'Frontend', emoji: '🌐', desc: 'React SPA' },
  { id: 'backend', label: 'Backend', emoji: '⚙️', desc: 'FastAPI core services' },
  { id: 'db', label: 'Database', emoji: '🗄️', desc: 'PostgreSQL' },
  { id: 'jenkins', label: 'Jenkins', emoji: '🔧', desc: 'Pipeline orchestrator' },
  { id: 'github', label: 'GitHub', emoji: '📂', desc: 'Source repository' },
  { id: 'llm', label: 'LLM / SAST', emoji: '🤖', desc: 'Groq · OpenAI · Semgrep' },
];

const steps = [
  {
    id: '01',
    title: 'Access & Authentication',
    summary: '사용자는 SPA에 접속하고 백엔드가 세션을 발급합니다.',
    callout: '사용자 → Frontend → Backend → DB',
    active: ['user', 'frontend', 'backend', 'db'],
    detail: ['JWT 발급 및 권한 컨텍스트 로딩', 'UI는 테마·세션 상태를 동기화'],
  },
  {
    id: '02',
    title: 'Project Onboarding',
    summary: '프로젝트 정보가 저장되고 Jenkins 파이프라인이 프로비저닝됩니다.',
    callout: 'Frontend → Backend ⇄ DB · Jenkins',
    active: ['frontend', 'backend', 'db', 'jenkins'],
    detail: ['메타데이터·기본 레포 정보 기록', 'Jenkins Job 자동 생성/동기화'],
  },
  {
    id: '03',
    title: 'Scan Orchestration',
    summary: '원클릭 스캔이 Jenkins로 전달되고 GitHub, LLM/SAST가 호출됩니다.',
    callout: 'Frontend → Backend → Jenkins → GitHub · LLM',
    active: ['frontend', 'backend', 'jenkins', 'github', 'llm'],
    detail: ['코드 체크아웃 · SAST 실행 · LLM 인사이트 생성', '상태/로그는 백엔드에 실시간 반영'],
  },
  {
    id: '04',
    title: 'Insight & Reporting',
    summary: '결과가 DB에 저장되고 대시보드에서 시각화됩니다.',
    callout: 'Jenkins → Backend ⇄ DB → Frontend → User',
    active: ['backend', 'db', 'jenkins', 'frontend', 'user'],
    detail: ['취약점 요약·타임라인·KPI 업데이트', 'PDF/HTML 리포트, 알림 채널 전달'],
  },
];

function SystemFlow3() {
  const { isDark } = useContext(ThemeContext);

  const shellBg = isDark
    ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100'
    : 'bg-gradient-to-br from-white via-slate-50 to-indigo-50 text-slate-900';

  const cardBase = isDark
    ? 'bg-slate-900/80 border border-slate-700/70 shadow-indigo-500/10'
    : 'bg-white border border-slate-200 shadow-indigo-200/50';

  return (
    <div className={`min-h-screen ${shellBg}`}>
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        <header className="space-y-4">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] font-semibold text-indigo-400">
            Sequence Diagram
            <span className="block w-1.5 h-1.5 rounded-full bg-indigo-400" />
          </span>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            L2VE Security Platform — Consulting View
          </h1>
          <p className={`max-w-3xl text-sm leading-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            주요 이해관계자(레인)와 상호작용을 컨설팅 피치덱에 활용할 수 있도록 재구성했습니다. 각 단계별 핵심
            메시지와 참여 시스템만 남겨 PPT에 바로 삽입 가능한 형태로 정리했습니다.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {actors.map((actor) => (
            <div
              key={actor.id}
              className={`${cardBase} rounded-3xl px-4 py-5 flex flex-col items-center text-center backdrop-blur`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3 ${isDark ? 'bg-indigo-500/20 text-indigo-200' : 'bg-indigo-50 text-indigo-500'}`}>
                {actor.emoji}
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wide">{actor.label}</h3>
              <p className={`mt-2 text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{actor.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-6">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`${cardBase} rounded-3xl px-6 py-6 md:px-8 md:py-8 backdrop-blur relative overflow-hidden`}
            >
              <div
                className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent"
                aria-hidden
              />
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold tracking-[0.35em] uppercase ${isDark ? 'text-indigo-300/80' : 'text-indigo-500/80'}`}>
                    {step.id}
                  </span>
                  <h2 className="text-lg md:text-xl font-semibold">{step.title}</h2>
                </div>
                <span className={`text-xs md:text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {step.callout}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-7 gap-4 items-start">
                {actors.map((actor) => {
                  const isActive = step.active.includes(actor.id);
                  return (
                    <div key={`${step.id}-${actor.id}`} className="flex flex-col items-center text-center space-y-2">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                          isActive
                            ? isDark
                              ? 'bg-indigo-500/30 text-indigo-200 ring-2 ring-indigo-400/60'
                              : 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-400/60'
                            : isDark
                              ? 'bg-slate-800 text-slate-500'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {actor.emoji}
                      </div>
                      <p
                        className={`text-[10px] font-semibold uppercase tracking-wide ${isActive ? (isDark ? 'text-indigo-200' : 'text-indigo-500') : isDark ? 'text-slate-500' : 'text-slate-400'
                          }`}
                      >
                        {actor.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 grid md:grid-cols-2 gap-4">
                <div className={`rounded-2xl px-4 py-3 ${isDark ? 'bg-slate-900/60 border border-slate-700/80' : 'bg-indigo-50/60 border border-indigo-100'}`}>
                  <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{step.summary}</p>
                </div>
                <ul className={`space-y-2 text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {step.detail.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export default SystemFlow3;

