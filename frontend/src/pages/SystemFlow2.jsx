import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

const journey = [
  {
    id: '01',
    title: '접속 & 인증',
    emoji: '🔐',
    headline: '사용자는 프론트엔드에 접속하고, 백엔드에서 세션과 권한이 발급됩니다.',
    actors: ['👤 사용자', '🌐 프론트엔드', '⚙️ 백엔드', '🗄️ 데이터베이스'],
  },
  {
    id: '02',
    title: '프로젝트 온보딩',
    emoji: '🧩',
    headline: '프로젝트 정보가 저장되고 Jenkins 파이프라인이 준비됩니다.',
    actors: ['⚙️ 백엔드', '🗄️ 데이터베이스', '🔧 Jenkins'],
  },
  {
    id: '03',
    title: '보안 스캔 실행',
    emoji: '🚀',
    headline: '스캔 요청이 Jenkins로 전달되고, GitHub/LLM/SAST와 연동됩니다.',
    actors: ['🔧 Jenkins', '📂 GitHub', '🤖 LLM · SAST'],
  },
  {
    id: '04',
    title: '리포트 & 인사이트',
    emoji: '📊',
    headline: '결과가 백엔드에 적재되고 프론트엔드 대시보드로 전달됩니다.',
    actors: ['⚙️ 백엔드', '🗄️ 데이터베이스', '🌐 프론트엔드', '👤 사용자'],
  },
];

const ecosystems = [
  {
    name: 'Jenkins',
    role: 'CI 파이프라인',
    desc: '스캔 파이프라인 실행, 외부 분석 서비스 호출',
  },
  {
    name: 'GitHub',
    role: '소스 레포지토리',
    desc: '분석 대상 코드/설정 제공',
  },
  {
    name: 'LLM / SAST',
    role: '보안 분석 엔진',
    desc: 'Semgrep 기반 SAST + LLM 인사이트 생성',
  },
];

function SystemFlow2() {
  const { isDark } = useContext(ThemeContext);

  const bgLayer = isDark
    ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100'
    : 'bg-gradient-to-br from-slate-50 via-indigo-50/60 to-white text-slate-900';
  const cardBase = isDark
    ? 'bg-slate-900/80 border border-slate-700/80 shadow-indigo-500/10'
    : 'bg-white/90 border border-slate-200 shadow-indigo-200/50';

  return (
    <div className={`min-h-screen ${bgLayer}`}>
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        <header className="space-y-4">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] font-semibold text-indigo-400">
            Journey Map
            <span className="block w-1.5 h-1.5 rounded-full bg-indigo-400" />
          </span>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            L2VE Security Platform — High-Level Flow
          </h1>
          <p className={`max-w-3xl text-sm leading-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            PPT, 제안서, 워크숍 자료에 바로 담을 수 있도록 사용자 여정과 시스템 상호작용을 4개의 단계로 압축했습니다.
            각 카드에는 핵심 메시지와 연관된 주요 시스템만 배치해 한 눈에 이해할 수 있도록 구성했습니다.
          </p>
        </header>

        <section className="relative">
          <div
            className={`grid gap-6 md:grid-cols-2 xl:grid-cols-4 transition-all`}
          >
            {journey.map((step, index) => (
              <div
                key={step.id}
                className={`${cardBase} relative rounded-3xl px-6 py-7 backdrop-blur-lg overflow-hidden group`}
              >
                <div
                  className="absolute inset-0 rounded-3xl pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity duration-500"
                  style={{
                    background:
                      'radial-gradient(90% 90% at 50% 100%, rgba(99,102,241,0.18) 0%, rgba(14,165,233,0.08) 45%, rgba(129,140,248,0) 100%)',
                  }}
                />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide uppercase text-indigo-400/80">
                      {step.id.padStart(2, '0')}
                    </span>
                    <span className="text-lg md:text-xl">{step.emoji}</span>
                  </div>
                  <h2 className="text-lg md:text-xl font-semibold">
                    {step.title}
                  </h2>
                  <p className={`text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {step.headline}
                  </p>
                  <div className={`border-l-2 pl-4 space-y-2 ${isDark ? 'border-indigo-500/40' : 'border-indigo-200'}`}>
                    {step.actors.map((actor) => (
                      <p
                        key={actor}
                        className={`text-xs md:text-sm font-medium ${
                          isDark ? 'text-slate-200' : 'text-slate-700'
                        }`}
                      >
                        {actor}
                      </p>
                    ))}
                  </div>
                </div>
                {index < journey.length - 1 && (
                  <div className="hidden xl:block absolute top-1/2 -right-8 translate-x-full -translate-y-1/2 w-20 h-px bg-gradient-to-r from-indigo-500/60 via-indigo-400/90 to-transparent opacity-80" />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className={`${cardBase} rounded-3xl px-6 py-7`}>
            <h3 className="text-lg font-semibold mb-4">핵심 메시지</h3>
            <ul className={`space-y-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <li>• 사용자는 브라우저에서 모든 여정을 시작하고 마무리합니다.</li>
              <li>• 백엔드는 인증·프로젝트 관리·결과 집계를 담당합니다.</li>
              <li>• Jenkins, GitHub, LLM/SAST는 하나의 파이프라인에서 연동되는 외부 생태계입니다.</li>
              <li>• 결과는 항상 DB를 통해 백엔드로 집계된 후 UI에 전달됩니다.</li>
            </ul>
          </div>

          <div className={`${cardBase} rounded-3xl px-6 py-7`}>
            <h3 className="text-lg font-semibold mb-4">외부 생태계</h3>
            <div className="space-y-4">
              {ecosystems.map((eco) => (
                <div
                  key={eco.name}
                  className={`rounded-2xl px-4 py-3 border ${isDark ? 'border-slate-700/70 bg-slate-900/40' : 'border-slate-200 bg-white/80'} backdrop-blur`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-indigo-400 uppercase tracking-wide">
                      {eco.name}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{eco.role}</span>
                  </div>
                  <p className={`mt-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{eco.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default SystemFlow2;

