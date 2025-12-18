import React, { useEffect, useMemo, useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github.css';
import { severityMeta, sortVulnerabilitiesByOption } from './scanDetailUtils';

const PATCH_STYLES = {
  critical: {
    container: 'border-l-4 border-l-rose-500',
    headerBg: 'bg-gradient-to-r from-rose-50 via-white to-white',
    severityBadge: 'bg-rose-100 text-rose-700',
    chip: 'bg-rose-500/10 text-rose-600',
    timelineDot: 'bg-rose-500',
    codeBorder: 'border-rose-100',
    codeBg: 'bg-rose-50',
  },
  high: {
    container: 'border-l-4 border-l-orange-400',
    headerBg: 'bg-gradient-to-r from-orange-50 via-white to-white',
    severityBadge: 'bg-orange-100 text-orange-700',
    chip: 'bg-orange-500/10 text-orange-600',
    timelineDot: 'bg-orange-500',
    codeBorder: 'border-orange-100',
    codeBg: 'bg-orange-50',
  },
  medium: {
    container: 'border-l-4 border-l-amber-400',
    headerBg: 'bg-gradient-to-r from-amber-50 via-white to-white',
    severityBadge: 'bg-amber-100 text-amber-700',
    chip: 'bg-amber-500/10 text-amber-600',
    timelineDot: 'bg-amber-500',
    codeBorder: 'border-amber-100',
    codeBg: 'bg-amber-50',
  },
  low: {
    container: 'border-l-4 border-l-emerald-400',
    headerBg: 'bg-gradient-to-r from-emerald-50 via-white to-white',
    severityBadge: 'bg-emerald-100 text-emerald-700',
    chip: 'bg-emerald-500/10 text-emerald-600',
    timelineDot: 'bg-emerald-500',
    codeBorder: 'border-emerald-100',
    codeBg: 'bg-emerald-50',
  },
  default: {
    container: 'border-l-4 border-l-slate-400',
    headerBg: 'bg-gradient-to-r from-slate-50 via-white to-white',
    severityBadge: 'bg-slate-200 text-slate-700',
    chip: 'bg-slate-200 text-slate-700',
    timelineDot: 'bg-slate-500',
    codeBorder: 'border-slate-200',
    codeBg: 'bg-slate-50',
  },
};

const DEFAULT_PATCH = {
  summary: '',
  steps: [],
  code_diff: '',
  references: [],
  code_context: '',
  code_context_range: null,
  code_fix_patch: null,
};

const DIFF_VIEWER_STYLES = {
  light: {
    variables: {
      light: {
        addedBackground: '#ecfdf5',
        addedColor: '#065f46',
        removedBackground: '#fef2f2',
        removedColor: '#b91c1c',
        wordAddedBackground: '#bbf7d0',
        wordRemovedBackground: '#fecaca',
        wordAddedColor: '#047857',
        wordRemovedColor: '#b91c1c',
        gutterColor: '#94a3b8',
        gutterBackground: '#f8fafc',
      },
    },
    diffContainer: {
      borderRadius: '0.75rem',
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \'Liberation Mono\', \'Courier New\', monospace',
      fontSize: '13px',
      background: '#fff',
      width: '100%',
      minWidth: '100%',
      tableLayout: 'fixed',
      borderCollapse: 'collapse',
      pre: {
        margin: 0,
        padding: 0,
        minWidth: 'auto',
        width: '100%',
        whiteSpace: 'pre-wrap',
      },
    },
    lineNumber: {
      width: '100%',
      minWidth: '100%',
      color: '#94a3b8',
      padding: 0,
      margin: 0,
      textAlign: 'end',
      display: 'inline-block',
      fontWeight: 500,
    },
    marker: {
      width: '2.25rem',
      textAlign: 'center',
      fontWeight: 600,
      padding: '0 6px',
    },
    gutter: {
      borderRight: '1px solid #e2e8f0',
      background: '#f8fafc',
      minWidth: '4.25rem',
      width: '4.25rem',
      padding: '0 12px 0 8px',
      pre: {
        opacity: 1,
      },
    },
  },
  dark: {
    variables: {
      dark: {
        addedBackground: '#064e3b',
        addedColor: '#ecfdf5',
        removedBackground: '#7f1d1d',
        removedColor: '#fee2e2',
        wordAddedBackground: '#065f46',
        wordRemovedBackground: '#991b1b',
        wordAddedColor: '#bbf7d0',
        wordRemovedColor: '#fecaca',
        gutterColor: '#cbd5f5',
        gutterBackground: '#0f172a',
      },
    },
    diffContainer: {
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      overflow: 'hidden',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \'Liberation Mono\', \'Courier New\', monospace',
      fontSize: '13px',
      background: '#020617',
      width: '100%',
      minWidth: '100%',
      tableLayout: 'fixed',
      borderCollapse: 'collapse',
      pre: {
        margin: 0,
        padding: 0,
        minWidth: 'auto',
        width: '100%',
        whiteSpace: 'pre-wrap',
        color: '#e5e7eb',
      },
    },
    lineNumber: {
      width: '100%',
      minWidth: '100%',
      color: '#94a3b8',
      padding: 0,
      margin: 0,
      textAlign: 'end',
      display: 'inline-block',
      fontWeight: 500,
    },
    marker: {
      width: '2.25rem',
      textAlign: 'center',
      fontWeight: 600,
      padding: '0 6px',
      color: '#e2e8f0',
    },
    gutter: {
      borderRight: '1px solid #334155',
      background: '#0f172a',
      minWidth: '4.25rem',
      width: '4.25rem',
      padding: '0 12px 0 8px',
      pre: {
        opacity: 1,
        color: '#94a3b8',
      },
    },
  },
};

function InfoChip({ label, value, colorClass }) {
  if (!value) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      <span className="uppercase tracking-wide text-[11px] opacity-80">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function EmptyNotice({ message, tone = 'gray', isDark = false }) {
  const toneStyle = {
    gray: isDark
      ? 'bg-gray-800/70 border border-gray-700 text-gray-300'
      : 'bg-gray-50 border border-gray-200 text-gray-600',
    amber: isDark
      ? 'bg-amber-500/10 border border-amber-400/40 text-amber-200'
      : 'bg-amber-50 border border-amber-200 text-amber-700',
  };

  return <div className={`rounded-lg px-3 py-2 text-sm ${toneStyle[tone]}`}>{message}</div>;
}

const CodeBlock = ({ label, code, language = 'bash', isDark }) => {
  const codeRef = React.useRef(null);

  useEffect(() => {
    if (codeRef.current) {
      delete codeRef.current.dataset.highlighted;
      hljs.highlightElement(codeRef.current);
    }
  }, [code, language]);

  return (
    <div>
      {label && (
        <p className={`text-xs font-semibold uppercase mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
      )}
      <div
        className={`rounded-xl border px-4 py-3 text-sm font-mono whitespace-pre-wrap break-words overflow-auto ${isDark ? 'bg-slate-900/70 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
      >
        {code && code.trim().length > 0 ? (
          <pre className="!bg-transparent !p-0 !m-0 font-inherit">
            <code ref={codeRef} className={`language-${language} whitespace-pre-wrap break-all font-mono text-sm bg-transparent`}>
              {code}
            </code>
          </pre>
        ) : (
          '내용이 제공되지 않았습니다.'
        )}
      </div>
    </div>
  );
};

const PillList = ({ title, items, isDark }) => {
  if (!items || items.length === 0) {
    return (
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {title}: <span className="font-semibold">없음</span>
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className={`px-3 py-1 text-xs font-semibold rounded-full ${isDark ? 'bg-slate-800 border border-slate-600 text-slate-200' : 'bg-slate-100 border border-slate-200 text-slate-600'
              }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

function TestSection({ title, subtitle, data, isDark }) {
  const [expanded, setExpanded] = useState(false);

  if (!data) return null;

  const dependencies = Array.isArray(data.dependencies) ? data.dependencies : data.dependencies ? [data.dependencies] : [];
  const setupCommands = Array.isArray(data.setup_commands) ? data.setup_commands : data.setup_commands ? [data.setup_commands] : [];

  return (
    <div className={`rounded-2xl border ${isDark ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`w-full flex items-center justify-between px-5 py-4 text-left ${isDark ? 'text-gray-100' : 'text-gray-900'}`}
      >
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${expanded ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {data.description && (
            <div>
              <p className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>설명</p>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{data.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              프레임워크: <span className="font-semibold">{data.framework || '미지정'}</span>
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              테스트 파일: <span className="font-semibold">{data.file_path || '미지정'}</span>
            </p>
          </div>

          <PillList title="필요한 의존성" items={dependencies} isDark={isDark} />

          {setupCommands.length > 0 && (
            <div className="space-y-2">
              <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>사전 실행 명령</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {setupCommands.map((cmd, idx) => (
                  <li key={`${cmd}-${idx}`} className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {cmd}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <CodeBlock label="실행 명령어" code={data.command} language="bash" isDark={isDark} />
          {data.script && data.script.trim().length > 0 && <CodeBlock label="테스트 스크립트" code={data.script} language="python" isDark={isDark} />}
        </div>
      )}
    </div>
  );
}

function ScanPatchPanel({ vulnerabilities, isDark, sortOption = 'severity', onVisibleChange, scrollContainerRef }) {
  const [isCompactDiff, setIsCompactDiff] = useState(false);
  const diffViewerStyles = useMemo(() => DIFF_VIEWER_STYLES[isDark ? 'dark' : 'light'], [isDark]);

  useEffect(() => {
    const evaluateViewport = () => {
      if (typeof window === 'undefined') return;
      setIsCompactDiff(window.innerWidth < 1024);
    };

    evaluateViewport();
    window.addEventListener('resize', evaluateViewport);

    return () => window.removeEventListener('resize', evaluateViewport);
  }, []);

  const sortedVulnerabilities = useMemo(() => {
    return sortVulnerabilitiesByOption(Array.isArray(vulnerabilities) ? vulnerabilities : [], sortOption);
  }, [vulnerabilities, sortOption]);

  useEffect(() => {
    if (!onVisibleChange || !scrollContainerRef?.current) return;
    const root = scrollContainerRef.current;
    const targets = root.querySelectorAll('[id^="patch-vuln-"]');
    if (!targets || targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.5)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          const idx = parseInt(id.replace('patch-vuln-', ''), 10);
          if (!Number.isNaN(idx)) {
            onVisibleChange(idx);
          }
        }
      },
      { root, threshold: [0.5, 0.75] }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [onVisibleChange, scrollContainerRef, sortedVulnerabilities]);

  if (!sortedVulnerabilities || sortedVulnerabilities.length === 0) {
    return (
      <div
        className={`rounded-2xl border border-dashed p-12 text-center shadow-sm ${isDark
          ? 'bg-gray-900/60 border-gray-700 text-gray-200'
          : 'bg-white border-gray-300 text-gray-700'
          }`}
      >
        <p className="text-base font-semibold">패치가 필요한 취약점이 없습니다.</p>
        <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          새로운 스캔을 실행하여 최신 패치 제안을 확인하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedVulnerabilities.map((vuln, idx) => {
        const meta = severityMeta[vuln.severity] || severityMeta.medium;
        const style = PATCH_STYLES[vuln.severity] || PATCH_STYLES.default;
        const codeFixPatch =
          vuln.code_fix_patch ||
          (vuln.recommendation && vuln.recommendation.code_fix_patch) ||
          {};

        const infoChips = [
          vuln.file_path && vuln.file_path !== 'N/A' && { label: '파일', value: vuln.file_path },
          vuln.line_number && vuln.line_number !== 'N/A' && { label: '라인', value: vuln.line_number },
        ].filter(Boolean);

        const hasPatchSummary = Boolean(
          codeFixPatch && typeof codeFixPatch.notes === 'string' && codeFixPatch.notes.trim()
        );
        const hasCodeFix =
          codeFixPatch &&
          typeof codeFixPatch.original_snippet === 'string' &&
          typeof codeFixPatch.modified_snippet === 'string' &&
          codeFixPatch.original_snippet.trim() &&
          codeFixPatch.modified_snippet.trim();

        return (
          <div
            key={idx}
            id={`patch-vuln-${vuln.originalIndex ?? idx}`}
            className={`rounded-2xl overflow-hidden shadow-sm transition-shadow hover:shadow-md ${isDark ? 'bg-gray-900/70 border border-gray-700 text-gray-100' : 'border border-gray-200 bg-white'
              } ${style.container}`}
          >
            <div className={`px-6 py-5 border-b ${isDark ? 'border-gray-700 bg-gray-900/60' : style.headerBg}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full ${style.severityBadge}`}>
                      {meta.label}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-900/5 text-gray-700">
                      {vuln.cwe}
                    </span>
                  </div>
                  <h6 className="text-xl font-semibold text-gray-900 leading-snug">{vuln.title}</h6>
                  {vuln.description && (
                    <p className="text-sm text-gray-600 max-w-3xl whitespace-pre-line line-clamp-3">{vuln.description}</p>
                  )}
                </div>
              </div>

              {infoChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {infoChips.map((chip, index) => (
                    <InfoChip key={index} label={chip.label} value={chip.value} colorClass={style.chip} />
                  ))}
                </div>
              )}
            </div>

            <div className={`px-6 py-6 space-y-6 ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
              {hasPatchSummary && (
                <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-900/70 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <h6 className={`text-sm font-semibold uppercase mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    패치 요약
                  </h6>
                  <p className={`text-base leading-relaxed whitespace-pre-line ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    {codeFixPatch.notes}
                  </p>
                </div>
              )}

              {hasCodeFix && (
                <div
                  className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-900/70 border-gray-700' : `bg-white ${style.codeBorder}`
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <h6 className={`text-sm font-semibold uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      코드 수정 제안
                    </h6>
                    {(codeFixPatch.target_file && codeFixPatch.target_file !== 'N/A') ||
                      (codeFixPatch.line_range && codeFixPatch.line_range !== 'N/A') ? (
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>
                        {codeFixPatch.target_file && codeFixPatch.target_file !== 'N/A' ? codeFixPatch.target_file : ''}
                        {codeFixPatch.line_range && codeFixPatch.line_range !== 'N/A' ? ` · ${codeFixPatch.line_range}` : ''}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    <ReactDiffViewer
                      oldValue={codeFixPatch.original_snippet}
                      newValue={codeFixPatch.modified_snippet}
                      splitView={!isCompactDiff}
                      leftTitle={!isCompactDiff ? '원본 코드' : undefined}
                      rightTitle={!isCompactDiff ? '수정된 코드' : undefined}
                      hideLineNumbers={false}
                      showDiffOnly={false}
                      disableWordDiff
                      styles={diffViewerStyles}
                      useDarkTheme={isDark}
                      extraLinesSurroundingDiff={1}
                      className="diff-viewer"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4">

                <TestSection
                  title="기능 테스트 제안"
                  subtitle="정상 동작을 검증하기 위한 테스트입니다."
                  data={vuln.functional_test}
                  isDark={isDark}
                />
                <TestSection
                  title="보안 회귀 방지 테스트"
                  subtitle="취약점이 다시 발생하지 않는지 검증합니다."
                  data={vuln.security_regression_test}
                  isDark={isDark}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ScanPatchPanel;
