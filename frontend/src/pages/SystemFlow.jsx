import { useContext, useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import { ThemeContext } from '../contexts/ThemeContext';

// 개선된 다이어그램 정의 - 3단계 구조 (인증 제외)
const diagramDefinition = `
sequenceDiagram
  autonumber
  actor User as 👤 사용자
  participant Frontend as 🌐 프론트엔드
  participant Backend as ⚙️ 백엔드
  participant DB as 🗄️ 데이터베이스
  participant Jenkins as 🔧 Jenkins
  participant GitHub as 📂 GitHub
  participant LLM as 🤖 LLM/SAST

  Note over User,LLM: 📦 Phase 1: 프로젝트 등록 및 스캔 트리거
  User->>Frontend: 새 프로젝트 생성 (이름, 설명)
  Frontend->>Backend: 프로젝트 등록 요청
  Backend->>DB: 프로젝트 정보 저장 (프로젝트 ID 생성)
  DB-->>Backend: 프로젝트 생성 완료
  Backend-->>Frontend: 프로젝트 등록 성공
  Frontend-->>User: 프로젝트 대시보드 표시
  User->>Frontend: 스캔 실행 (GitHub URL, 스캔 타입, LLM 모델 선택)
  Frontend->>Backend: 스캔 트리거 요청
  Backend->>DB: 스캔 레코드 생성 (status: pending)
  DB-->>Backend: 스캔 ID 반환
  Backend->>Jenkins: 파이프라인 실행 요청 (스캔 파라미터 전달)
  Jenkins-->>Backend: 빌드 큐 등록 완료
  Backend-->>Frontend: 스캔 시작 알림
  Frontend-->>User: 스캔 진행 중 상태 표시

  Note over User,LLM: 🔍 Phase 2: 소스코드 분석 및 취약점 탐지
  Jenkins->>GitHub: 소스코드 클론 (GitHub URL)
  GitHub-->>Jenkins: 소스코드 다운로드 완료
  Jenkins->>LLM: SAST 스캔 실행 (선택적)
  LLM-->>Jenkins: SAST 결과 반환
  Jenkins->>LLM: LLM 기반 취약점 분석 요청 (소스코드 + 패턴)
  LLM-->>Jenkins: 취약점 분석 결과 (JSON)
  Jenkins->>Jenkins: 결과 정규화 및 파싱

  Note over User,LLM: 📊 Phase 3: 결과 저장 및 시각화
  Jenkins->>Backend: 분석 결과 전송 (콜백 API)
  Backend->>DB: 취약점 데이터 저장 (심각도, CWE, 파일 경로 등)
  Backend->>DB: 스캔 상태 업데이트 (status: completed)
  DB-->>Backend: 저장 완료
  Backend-->>Jenkins: 수신 확인 (200 OK)
  User->>Frontend: 스캔 결과 확인 요청
  Frontend->>Backend: 스캔 결과 조회 API 호출
  Backend->>DB: 취약점 데이터 조회 (심각도별 통계 포함)
  DB-->>Backend: 데이터 반환
  Backend-->>Frontend: 스캔 결과 및 통계 데이터
  Frontend-->>User: 대시보드에 취약점 목록 및 인사이트 표시
`;

function SystemFlow() {
  const { isDark } = useContext(ThemeContext);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const theme = useMemo(() => (isDark ? 'dark' : 'default'), [isDark]);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme,
      themeVariables: {
        primaryColor: isDark ? '#6366F1' : '#6366F1',
        primaryTextColor: isDark ? '#F3F4F6' : '#1F2937',
        primaryBorderColor: isDark ? '#818CF8' : '#4F46E5',
        lineColor: isDark ? '#A78BFA' : '#6366F1',
        secondaryColor: isDark ? '#8B5CF6' : '#818CF8',
        tertiaryColor: isDark ? '#EC4899' : '#A855F7',
        actorBorder: isDark ? '#818CF8' : '#6366F1',
        actorTextColor: isDark ? '#F3F4F6' : '#1F2937',
        actorBkg: isDark ? '#1E1B4B' : '#EEF2FF',
        activationBkgColor: isDark ? '#3730A3' : '#E0E7FF',
        activationBorderColor: isDark ? '#818CF8' : '#6366F1',
        noteBkgColor: isDark ? '#312E81' : '#F5F3FF',
        noteTextColor: isDark ? '#E0E7FF' : '#1F2937',
        noteBorderColor: isDark ? '#818CF8' : '#6366F1',
        sequenceNumberColor: isDark ? '#F3F4F6' : '#1F2937',
      },
      flowchart: {
        curve: 'basis',
        padding: 20,
      },
    });

    let isCancelled = false;

    const renderDiagram = async () => {
      try {
        const { svg: svgOutput } = await mermaid.render('system-flow-diagram', diagramDefinition);
        if (!isCancelled) {
          setSvg(svgOutput);
          setError('');
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err?.message || '다이어그램 렌더링에 실패했습니다.');
        }
      }
    };

    renderDiagram();

    return () => {
      isCancelled = true;
    };
  }, [theme, isDark]);

  return (
    <div
      className={`min-h-screen relative overflow-hidden ${isDark
        ? 'bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-900 text-slate-100'
        : 'bg-gradient-to-br from-slate-50 via-indigo-50/50 to-white text-slate-900'
        }`}
    >
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className={`absolute top-0 -left-4 w-96 h-96 ${isDark ? 'bg-indigo-600/20' : 'bg-indigo-300/30'
            } rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob`}
        />
        <div
          className={`absolute top-0 -right-4 w-96 h-96 ${isDark ? 'bg-purple-600/20' : 'bg-purple-300/30'
            } rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000`}
        />
        <div
          className={`absolute -bottom-8 left-20 w-96 h-96 ${isDark ? 'bg-cyan-600/20' : 'bg-cyan-300/30'
            } rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000`}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 space-y-10 relative z-10">
        {/* Header with glassmorphism */}
        <header
          className={`space-y-4 backdrop-blur-xl rounded-3xl p-8 border ${isDark
            ? 'bg-slate-900/60 border-slate-700/50 shadow-2xl shadow-indigo-950/20'
            : 'bg-white/70 border-indigo-100/50 shadow-2xl shadow-indigo-100/20'
            }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'
                } animate-pulse`}
            />
            <p
              className={`text-xs uppercase tracking-[0.3em] font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-600'
                }`}
            >
              Platform Architecture
            </p>
          </div>
          <h1
            className={`text-5xl md:text-6xl font-extrabold bg-gradient-to-r ${isDark
              ? 'from-indigo-300 via-purple-300 to-cyan-300'
              : 'from-indigo-600 via-purple-600 to-cyan-600'
              } bg-clip-text text-transparent leading-tight`}
          >
            System Flow
            <br />
            <span className="text-3xl md:text-4xl">Sequence Diagram</span>
          </h1>
          <p
            className={`max-w-3xl text-base leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
          >
            프로젝트 등록부터 취약점 분석 결과 확인까지, L2VE 플랫폼의 핵심 데이터 흐름을
            <span className="font-semibold"> 3단계 Phase</span>로 구분하여 시각화했습니다.
            각 단계별 상세한 시스템 상호작용과 데이터 전달 과정을 확인할 수 있습니다.
          </p>
        </header>

        {/* Main diagram card with enhanced styling */}
        <div
          className={`rounded-3xl border-2 shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-300 hover:shadow-3xl ${isDark
            ? 'bg-slate-900/80 border-indigo-500/30 shadow-indigo-950/50 hover:border-indigo-400/50'
            : 'bg-white/90 border-indigo-200/50 shadow-indigo-200/30 hover:border-indigo-300/70'
            }`}
        >
          {/* Card header */}
          <div
            className={`px-8 py-5 border-b backdrop-blur-sm flex items-center justify-between ${isDark
              ? 'bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border-indigo-500/20'
              : 'bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border-indigo-200/50'
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'
                  } shadow-lg shadow-indigo-500/50`}
              />
              <span
                className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-indigo-200' : 'text-indigo-700'
                  }`}
              >
                UML Sequence Diagram
              </span>
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                }`}
            >
              Mermaid.js
            </div>
          </div>

          {/* Diagram container with custom styling */}
          <div
            className={`p-8 md:p-12 overflow-auto ${isDark ? 'bg-slate-950/50' : 'bg-gradient-to-br from-slate-50/50 to-white'
              }`}
          >
            {error ? (
              <div
                className={`rounded-xl border-2 px-6 py-4 text-sm font-medium ${isDark
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
              >
                {error}
              </div>
            ) : (
              <div
                className="mermaid-diagram-container [&_svg]:drop-shadow-2xl [&_svg]:mx-auto [&_svg]:transition-all [&_svg]:duration-500"
                style={{
                  filter: isDark ? 'brightness(1.1) contrast(1.05)' : 'brightness(1) contrast(1.02)',
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>
        </div>

        {/* Phase별 상세 설명 카드 - 3단계 구조 */}
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Phase 1: 프로젝트 등록 및 스캔 트리거 */}
          <div
            className={`rounded-2xl p-6 backdrop-blur-xl border-2 transition-all duration-300 hover:scale-[1.02] ${isDark
              ? 'bg-slate-900/60 border-indigo-500/20 shadow-xl shadow-indigo-950/20 hover:border-indigo-400/40'
              : 'bg-white/70 border-indigo-200/50 shadow-xl shadow-indigo-100/20 hover:border-indigo-300/70'
              }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                1
              </div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>
                프로젝트 등록 및 스캔 트리거
              </h2>
            </div>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              분석할 소프트웨어 프로젝트를 플랫폼에 등록하고, GitHub 저장소 URL과 분석 옵션을 선택하여
              보안 스캔을 시작합니다. Backend는 프로젝트 정보와 스캔 레코드를 생성한 후 Jenkins 파이프라인을 실행합니다.
            </p>
          </div>

          {/* Phase 2: 소스코드 분석 및 취약점 탐지 */}
          <div
            className={`rounded-2xl p-6 backdrop-blur-xl border-2 transition-all duration-300 hover:scale-[1.02] ${isDark
              ? 'bg-slate-900/60 border-purple-500/20 shadow-xl shadow-purple-950/20 hover:border-purple-400/40'
              : 'bg-white/70 border-purple-200/50 shadow-xl shadow-purple-100/20 hover:border-purple-300/70'
              }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                2
              </div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-purple-200' : 'text-purple-700'}`}>
                소스코드 분석 및 취약점 탐지
              </h2>
            </div>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Jenkins가 GitHub에서 소스코드를 다운로드한 후, Semgrep SAST 스캔(선택적)과 LLM 기반 취약점 분석을 수행합니다.
              LLM은 소스코드 패턴을 분석하여 보안 취약점을 탐지하고, 결과를 정규화하여 구조화된 데이터로 변환합니다.
            </p>
          </div>

          {/* Phase 3: 결과 저장 및 시각화 */}
          <div
            className={`rounded-2xl p-6 backdrop-blur-xl border-2 transition-all duration-300 hover:scale-[1.02] ${isDark
              ? 'bg-slate-900/60 border-cyan-500/20 shadow-xl shadow-cyan-950/20 hover:border-cyan-400/40'
              : 'bg-white/70 border-cyan-200/50 shadow-xl shadow-cyan-100/20 hover:border-cyan-300/70'
              }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm">
                3
              </div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-cyan-200' : 'text-cyan-700'}`}>
                결과 저장 및 시각화
              </h2>
            </div>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              분석 결과를 Backend로 전송하여 데이터베이스에 저장합니다. 취약점 정보(심각도, CWE, 파일 경로, PoC 등)가
              저장된 후, 사용자는 대시보드에서 취약점 목록, 심각도별 통계, 상세 분석 결과를 확인할 수 있습니다.
            </p>
          </div>
        </section>

        {/* 주요 특징 설명 */}
        <section className="grid gap-6 md:grid-cols-2">
          <div
            className={`rounded-2xl p-6 backdrop-blur-xl border-2 transition-all duration-300 hover:scale-[1.02] ${isDark
              ? 'bg-slate-900/60 border-indigo-500/20 shadow-xl shadow-indigo-950/20 hover:border-indigo-400/40'
              : 'bg-white/70 border-indigo-200/50 shadow-xl shadow-indigo-100/20 hover:border-indigo-300/70'
              }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark
                  ? 'bg-indigo-500/20 border border-indigo-400/30'
                  : 'bg-indigo-100 border border-indigo-200'
                  }`}
              >
                <svg
                  className={`w-5 h-5 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>
                핵심 특징
              </h2>
            </div>
            <ul className={`space-y-3 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <li className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'}`} />
                <span><strong>비동기 처리:</strong> Jenkins 파이프라인을 통해 대용량 코드 분석을 비동기적으로 처리합니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'}`} />
                <span><strong>하이브리드 분석:</strong> 전통적인 SAST 도구(Semgrep)와 LLM 기반 분석을 결합하여 정확도를 향상시킵니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'}`} />
                <span><strong>실시간 피드백:</strong> 스캔 진행 상황을 실시간으로 모니터링하고 완료 시 즉시 알림을 제공합니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'}`} />
                <span><strong>콜백 메커니즘:</strong> Jenkins에서 분석 완료 후 Backend로 자동 콜백하여 결과를 저장합니다.</span>
              </li>
            </ul>
          </div>

          <div
            className={`rounded-2xl p-6 backdrop-blur-xl border-2 transition-all duration-300 hover:scale-[1.02] ${isDark
              ? 'bg-slate-900/60 border-purple-500/20 shadow-xl shadow-purple-950/20 hover:border-purple-400/40'
              : 'bg-white/70 border-purple-200/50 shadow-xl shadow-purple-100/20 hover:border-purple-300/70'
              }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark
                  ? 'bg-purple-500/20 border border-purple-400/30'
                  : 'bg-purple-100 border border-purple-200'
                  }`}
              >
                <svg
                  className={`w-5 h-5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-purple-200' : 'text-purple-700'}`}>
                시스템 구성
              </h2>
            </div>
            <ul className={`space-y-3 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <li className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
                <span><strong>프론트엔드:</strong> React 기반 SPA로 사용자 인터페이스를 제공합니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
                <span><strong>백엔드:</strong> FastAPI로 RESTful API를 제공하며, JWT 기반 인증과 권한 관리를 담당합니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
                <span><strong>Jenkins:</strong> CI/CD 파이프라인을 통해 소스코드 분석 작업을 오케스트레이션합니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
                <span><strong>데이터베이스:</strong> MySQL에 프로젝트, 스캔, 취약점 정보를 영구 저장합니다.</span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .mermaid-diagram-container svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}

export default SystemFlow;

