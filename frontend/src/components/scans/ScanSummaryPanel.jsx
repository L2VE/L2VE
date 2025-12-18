import { useMemo, useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github.css';
import { severityMeta, SEVERITY_ORDER, SCAN_SORT_OPTIONS, sortVulnerabilitiesByOption } from './scanDetailUtils';

function CodeSnippet({ code, language = 'python', wrapperClass = '' }) {
  const codeRef = useRef(null);

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code]);

  if (!code) return null;

  return (
    <pre className={wrapperClass}>
      <code ref={codeRef} className={`language-${language}`}>
        {code}
      </code>
    </pre>
  );
}

const STAT_CARDS = [
  {
    key: 'total',
    label: '전체',
    subtitle: '발견사항',
    border: 'border-indigo-200 hover:border-indigo-300',
    badgeClass: 'text-indigo-600',
    iconStroke: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    highlight: 'bg-indigo-50',
    highlightIcon: 'text-indigo-600',
  },
  {
    key: 'critical',
    label: '위험',
    subtitle: '위험',
    borderActive: 'border-rose-600 hover:border-rose-700',
    badgeClass: 'text-rose-700',
    iconStroke: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    highlight: 'bg-rose-100',
    highlightIcon: 'text-rose-600',
  },
  {
    key: 'high',
    label: '높음',
    subtitle: '높음',
    borderActive: 'border-orange-600 hover:border-orange-700',
    badgeClass: 'text-orange-700',
    iconStroke: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    highlight: 'bg-orange-100',
    highlightIcon: 'text-orange-600',
  },
  {
    key: 'medium',
    label: '중간',
    subtitle: '중간',
    borderActive: 'border-amber-600 hover:border-amber-700',
    badgeClass: 'text-amber-700',
    iconStroke: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    highlight: 'bg-amber-100',
    highlightIcon: 'text-amber-600',
  },
  {
    key: 'low',
    label: '낮음',
    subtitle: '낮음',
    borderActive: 'border-yellow-600 hover:border-yellow-700',
    badgeClass: 'text-yellow-700',
    iconStroke: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    highlight: 'bg-yellow-100',
    highlightIcon: 'text-yellow-600',
  },
];

const OWASP_CATEGORY_DEFINITIONS = {
  A01: {
    id: 'A01',
    name: 'Broken Access Control',
    color: 'rose',
    iconPath: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  },
  A02: {
    id: 'A02',
    name: 'Cryptographic Failures',
    color: 'default',
    iconPath: 'M12 11c-1.657 0-3 1.343-3 3v4h6v-4c0-1.657-1.343-3-3-3zm0-7a4 4 0 014 4v2H8V8a4 4 0 014-4z',
  },
  A03: {
    id: 'A03',
    name: 'Injection',
    color: 'red',
    iconPath: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
  A04: {
    id: 'A04',
    name: 'Insecure Design',
    color: 'orange',
    iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  },
  A05: {
    id: 'A05',
    name: 'Security Misconfiguration',
    color: 'orange',
    iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  },
  A06: {
    id: 'A06',
    name: 'Vulnerable & Outdated Components',
    color: 'default',
    iconPath: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  },
  A07: {
    id: 'A07',
    name: 'Identification & Authentication Failures',
    color: 'amber',
    iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  A08: {
    id: 'A08',
    name: 'Software & Data Integrity Failures',
    color: 'default',
    iconPath: 'M12 6v12m6-6H6',
  },
  A09: {
    id: 'A09',
    name: 'Security Logging & Monitoring Failures',
    color: 'default',
    iconPath: 'M3 7h4a4 4 0 014 4v6h6a4 4 0 004-4V7',
  },
  A10: {
    id: 'A10',
    name: 'Server-Side Request Forgery',
    color: 'yellow',
    iconPath: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  },
  OTHER: {
    id: 'OTHER',
    name: '기타',
    color: 'default',
    iconPath: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  },
};

const CWE_TO_OWASP = {
  'CWE-79': 'A03',
  'CWE-74': 'A03',
  'CWE-89': 'A03',
  'CWE-78': 'A03',
  'CWE-209': 'A01',
  'CWE-200': 'A01',
  'CWE-201': 'A01',
  'CWE-639': 'A01',
  'CWE-352': 'A05',
  'CWE-434': 'A05',
  'CWE-532': 'A05',
  'CWE-601': 'A10',
  'CWE-918': 'A10',
  'CWE-611': 'A05',
  'CWE-522': 'A05',
  'CWE-287': 'A07',
};

const ATTACK_VECTOR_RULES = [
  {
    key: 'xss',
    type: 'XSS',
    label: 'Cross-Site Scripting',
    color: 'rose',
    iconPath: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    match: (vuln) =>
      /xss/i.test(vuln.title || '') ||
      /cross[\s-]?site/i.test(vuln.title || '') ||
      /CWE-79/i.test(vuln.cwe || ''),
  },
  {
    key: 'ssrf',
    type: 'SSRF',
    label: 'Server-Side Request Forgery',
    color: 'orange',
    iconPath: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
    match: (vuln) =>
      /ssrf/i.test(vuln.title || '') ||
      /server[-\s]?side request/i.test(vuln.title || '') ||
      /CWE-918/i.test(vuln.cwe || ''),
  },
  {
    key: 'idor',
    type: 'IDOR',
    label: 'Insecure Direct Object Reference',
    color: 'amber',
    iconPath: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
    match: (vuln) =>
      /idor/i.test(vuln.title || '') ||
      /insecure direct/i.test(vuln.title || '') ||
      /CWE-639|CWE-209/i.test(vuln.cwe || ''),
  },
  {
    key: 'open_redirect',
    type: 'Open Redirect',
    label: 'URL Redirection',
    color: 'yellow',
    iconPath: 'M13 7l5 5m0 0l-5 5m5-5H6',
    match: (vuln) =>
      /redirect/i.test(vuln.title || '') ||
      /open redirect/i.test(vuln.description || '') ||
      /CWE-601/i.test(vuln.cwe || ''),
  },
  {
    key: 'sql_injection',
    type: 'SQL Injection',
    label: 'SQL Injection',
    color: 'rose',
    iconPath: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
    match: (vuln) =>
      /sql/i.test(vuln.title || '') ||
      /CWE-89|CWE-74/i.test(vuln.cwe || ''),
  },
  {
    key: 'command_injection',
    type: 'Command Injection',
    label: 'Command/Code Injection',
    color: 'orange',
    iconPath: 'M10 20l4-16m6 8l-6-6m0 12l6-6M4 6h4v4H4z',
    match: (vuln) =>
      /command injection|remote code|rce/i.test(vuln.title || '') ||
      /CWE-78|CWE-94/i.test(vuln.cwe || ''),
  },
];

const ATTACK_VECTOR_FALLBACK = {
  key: 'other',
  type: '기타',
  label: '기타 취약점',
  color: 'default',
  iconPath: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
};

const OWASP_COLOR_META = {
  rose: {
    iconBg: 'bg-rose-100',
    icon: 'text-rose-600',
    barGradient: 'from-rose-500 to-rose-700',
  },
  red: {
    iconBg: 'bg-red-100',
    icon: 'text-red-600',
    barGradient: 'from-red-500 to-red-700',
  },
  orange: {
    iconBg: 'bg-orange-100',
    icon: 'text-orange-600',
    barGradient: 'from-orange-500 to-orange-700',
  },
  amber: {
    iconBg: 'bg-amber-100',
    icon: 'text-amber-600',
    barGradient: 'from-amber-500 to-amber-700',
  },
  yellow: {
    iconBg: 'bg-yellow-100',
    icon: 'text-yellow-600',
    barGradient: 'from-yellow-500 to-yellow-700',
  },
  default: {
    iconBg: 'bg-gray-100',
    icon: 'text-gray-600',
    barGradient: 'from-gray-500 to-gray-700',
  },
};

const ATTACK_COLOR_META = {
  rose: {
    card: 'bg-gradient-to-br from-rose-50 to-white border border-rose-200',
    iconBg: 'bg-rose-100',
    icon: 'text-rose-600',
    count: 'text-rose-700',
    bar: 'bg-rose-500',
  },
  orange: {
    card: 'bg-gradient-to-br from-orange-50 to-white border border-orange-200',
    iconBg: 'bg-orange-100',
    icon: 'text-orange-600',
    count: 'text-orange-700',
    bar: 'bg-orange-500',
  },
  amber: {
    card: 'bg-gradient-to-br from-amber-50 to-white border border-amber-200',
    iconBg: 'bg-amber-100',
    icon: 'text-amber-600',
    count: 'text-amber-700',
    bar: 'bg-amber-500',
  },
  yellow: {
    card: 'bg-gradient-to-br from-yellow-50 to-white border border-yellow-200',
    iconBg: 'bg-yellow-100',
    icon: 'text-yellow-600',
    count: 'text-yellow-700',
    bar: 'bg-yellow-500',
  },
  default: {
    card: 'bg-gradient-to-br from-gray-50 to-white border border-gray-200',
    iconBg: 'bg-gray-100',
    icon: 'text-gray-600',
    count: 'text-gray-700',
    bar: 'bg-gray-500',
  },
};

const TAINT_RISK_BADGE = {
  critical: {
    light: 'bg-rose-100 text-rose-700',
    dark: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
  },
  high: {
    light: 'bg-orange-100 text-orange-700',
    dark: 'bg-orange-500/20 text-orange-200 border border-orange-400/40',
  },
  medium: {
    light: 'bg-amber-100 text-amber-700',
    dark: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
  },
  low: {
    light: 'bg-emerald-100 text-emerald-700',
    dark: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
  },
  default: {
    light: 'bg-gray-200 text-gray-700',
    dark: 'bg-slate-700/60 text-slate-200 border border-slate-500/60',
  },
};

const TAINT_SEGMENT_META = {
  source: {
    label: 'Source',
    badgeLight: 'bg-blue-100 text-blue-700 border border-blue-200',
    badgeDark: 'bg-blue-500/20 text-blue-200 border border-blue-400/40',
    borderLight: 'border-blue-200',
    borderDark: 'border-blue-400/40',
    placeholder: '신뢰되지 않은 입력이 유입되는 구간을 식별합니다.',
  },
  propagation: {
    label: 'Propagation',
    badgeLight: 'bg-amber-100 text-amber-700 border border-amber-200',
    badgeDark: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
    borderLight: 'border-amber-200',
    borderDark: 'border-amber-400/40',
    placeholder: '검증되지 않은 데이터가 전파되는 경로를 요약합니다.',
  },
  sink: {
    label: 'Sink',
    badgeLight: 'bg-rose-100 text-rose-700 border border-rose-200',
    badgeDark: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
    borderLight: 'border-rose-200',
    borderDark: 'border-rose-400/40',
    placeholder: '최종적으로 취약점이 발생하는 지점을 설명합니다.',
  },
};

function ScanSummaryPanel({ selected, vulnerabilities, isDark = false, sortOption: controlledSortOption, onSortOptionChange, onVisibleChange, scrollContainerRef }) {
  const [internalSortOption, setInternalSortOption] = useState(controlledSortOption || 'severity');

  useEffect(() => {
    if (controlledSortOption && controlledSortOption !== internalSortOption) {
      setInternalSortOption(controlledSortOption);
    }
  }, [controlledSortOption, internalSortOption]);

  const effectiveSortOption = controlledSortOption ?? internalSortOption;

  const handleSortChange = (value) => {
    if (onSortOptionChange) {
      onSortOptionChange(value);
    }
    if (controlledSortOption === undefined) {
      setInternalSortOption(value);
    }
  };
  const structuredSummary = selected?.scan_results?.structured_result?.scan_summary; // ... existing code

  // ... (keep helper functions like themed, cardSurface, etc.)
  const themed = (light, dark) => (isDark ? dark : light);
  const cardSurface = themed(
    'bg-white border border-gray-200 shadow-sm',
    'bg-slate-900/70 border border-slate-700/70 shadow-[0_10px_35px_rgba(2,6,23,0.55)]'
  );
  // ... (re-declare other theme helpers to match context, or rely on them being there if not replacing them)
  // Actually, I should check where I am inserting. I am replacing lines 365-xxx.
  // Wait, the context inside the function is needed.
  // Let's replace the beginning of the function and insert the logic.

  const subtleSurface = themed('bg-gray-50 border border-gray-200', 'bg-slate-900/40 border border-slate-700/60');
  const headingText = themed('text-gray-900', 'text-slate-100');
  const bodyText = themed('text-gray-700', 'text-slate-200');
  const secondaryText = themed('text-gray-600', 'text-slate-400');
  const mutedText = themed('text-gray-500', 'text-slate-500');

  const scrollToVuln = (index) => {
    const element = document.getElementById(`vuln-detail-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 약간의 하이라이트 효과를 줄 수도 있음
      element.classList.add('ring-2', 'ring-indigo-500', 'transition-all', 'duration-500');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-indigo-500');
      }, 2000);
    }
  };

  // ... (getStatusBadge, getEmptyStateMeta... keep these)
  const getStatusBadge = (status) => { // ... copied or preserved
    const palette = {
      completed: {
        light: 'bg-emerald-100 text-emerald-700',
        dark: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
      },
      failed: {
        light: 'bg-rose-100 text-rose-700',
        dark: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
      },
      running: {
        light: 'bg-blue-100 text-blue-700',
        dark: 'bg-blue-500/20 text-blue-200 border border-blue-400/40',
      },
    };
    const fallback = { light: 'bg-gray-100 text-gray-700', dark: 'bg-slate-700/60 text-slate-200 border border-slate-500/60' };
    const paletteEntry = palette[status] || fallback;
    return themed(paletteEntry.light, paletteEntry.dark);
  };

  const getEmptyStateMeta = (status) => {
    const palette = {
      completed: {
        iconWrapperLight: 'w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4',
        iconWrapperDark: 'w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-400/40',
        iconClassLight: 'w-8 h-8 text-green-600',
        iconClassDark: 'w-8 h-8 text-emerald-200',
        iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        title: '✓ 취약점이 발견되지 않았습니다',
        description: '스캔이 성공적으로 완료되었으며 보안 문제가 감지되지 않았습니다.',
      },
      running: {
        iconWrapperLight: 'w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4',
        iconWrapperDark: 'w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-400/40',
        iconClassLight: 'w-8 h-8 text-blue-600',
        iconClassDark: 'w-8 h-8 text-blue-100',
        iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        title: '스캔이 진행 중입니다',
        description: '스캔이 아직 완료되지 않았습니다. 잠시 후 다시 확인해주세요.',
      },
      failed: {
        iconWrapperLight: 'w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4',
        iconWrapperDark: 'w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-400/40',
        iconClassLight: 'w-8 h-8 text-rose-600',
        iconClassDark: 'w-8 h-8 text-rose-100',
        iconPath: 'M10 10l4 4m0-4l-4 4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        title: '스캔이 실패했습니다',
        description: '파이프라인 로그를 확인하거나 설정을 검토한 후 다시 시도해주세요.',
      },
      default: {
        iconWrapperLight: 'w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4',
        iconWrapperDark: 'w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700/60',
        iconClassLight: 'w-8 h-8 text-gray-600',
        iconClassDark: 'w-8 h-8 text-slate-200',
        iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        title: '스캔 상태를 확인할 수 없습니다',
        description: '잠시 후 다시 시도하거나 관리자에게 문의해주세요.',
      },
    };
    const meta = palette[status] || palette.default;
    return {
      iconWrapper: themed(meta.iconWrapperLight, meta.iconWrapperDark),
      iconClass: themed(meta.iconClassLight, meta.iconClassDark),
      iconPath: meta.iconPath,
      title: meta.title,
      description: meta.description,
    };
  };

  const getSeverityBadge = (key) => {
    const meta = severityMeta[key] || severityMeta.medium;
    return themed(meta.badge, meta.darkBadge);
  };

  const getTaintRiskBadge = (risk) => {
    const palette = TAINT_RISK_BADGE[risk] || TAINT_RISK_BADGE.default;
    return themed(palette.light, palette.dark);
  };

  const buildSegmentMeta = (stageKey) => {
    const meta = TAINT_SEGMENT_META[stageKey];
    if (!meta) {
      return { badge: '', border: '' };
    }
    return {
      badge: themed(meta.badgeLight, meta.badgeDark),
      border: themed(meta.borderLight, meta.borderDark),
      label: meta.label,
      placeholder: meta.placeholder,
    };
  };

  const normalizedStructuredVulns = useMemo(() => {
    const structuredVulns = selected?.scan_results?.structured_result?.vulnerabilities;
    if (!Array.isArray(structuredVulns) || structuredVulns.length === 0) return [];

    return structuredVulns.map((vuln) => {
      const location = vuln?.location && typeof vuln.location === 'object' ? vuln.location : {};
      return {
        title: vuln.vulnerability_title || vuln.title || '미지정 취약점',
        severity: String(vuln.severity || 'medium').toLowerCase(),
        cwe: Array.isArray(vuln.cwe) ? vuln.cwe.find(Boolean) : vuln.cwe || location.cwe || 'N/A',
        file_path: vuln.file_path || location.file_path || 'N/A',
        line_number: vuln.line_number || location.line_number || 'N/A',
        description: vuln.description || '',
      };
    });
  }, [selected]);

  const dedupeByLocation = useMemo(() => {
    return (list) => {
      const seen = new Set();
      return list.filter((vuln) => {
        const filePath = (vuln.file_path || '').toLowerCase();
        let normalizedLine = '';
        if (vuln.line_number && vuln.line_number !== 'N/A') {
          const matches = String(vuln.line_number).match(/\d+/g);
          if (matches) {
            normalizedLine = String(Math.min(...matches.map(Number)));
          }
        }
        const key = `${filePath}|${normalizedLine}|${(vuln.cwe || '').toUpperCase()}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    };
  }, []);

  const summarizedVulnerabilities = useMemo(() => {
    // 주입된 vulnerabilities가 있으면 추가 dedupe 없이 그대로 사용 (DB가 이미 정규화/중복 제거 수행)
    if (Array.isArray(vulnerabilities) && vulnerabilities.length > 0) {
      return vulnerabilities;
    }
    // fallback: structured_result 기반 dedupe
    return dedupeByLocation(normalizedStructuredVulns);
  }, [vulnerabilities, normalizedStructuredVulns, dedupeByLocation]);

  // Add originalIndex to track items across sorting
  const vulnerabilitiesWithIndex = useMemo(() => {
    return (vulnerabilities.length > 0 ? vulnerabilities : summarizedVulnerabilities).map((v, i) => ({ ...v, originalIndex: i }));
  }, [vulnerabilities, summarizedVulnerabilities]);

  const sortedVulnerabilities = useMemo(() => {
    return sortVulnerabilitiesByOption(vulnerabilitiesWithIndex, effectiveSortOption);
  }, [vulnerabilitiesWithIndex, effectiveSortOption]);

  useEffect(() => {
    if (!onVisibleChange || !scrollContainerRef?.current) return;
    const root = scrollContainerRef.current;
    const targets = root.querySelectorAll('[id^="vuln-detail-"]');
    if (!targets || targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.5)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          const idx = parseInt(id.replace('vuln-detail-', ''), 10);
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

  const derivedCounts = useMemo(() => {
    const counts = { total: summarizedVulnerabilities.length, critical: 0, high: 0, medium: 0, low: 0 };
    summarizedVulnerabilities.forEach((vuln) => {
      const severity = SEVERITY_ORDER.includes(vuln.severity) ? vuln.severity : 'medium';
      counts[severity] += 1;
    });
    return counts;
  }, [summarizedVulnerabilities]);

  const summaryCounts = {
    total: derivedCounts.total || structuredSummary?.total_findings || selected.vulnerabilities_found || 0,
    critical: derivedCounts.critical || structuredSummary?.critical || selected.critical || 0,
    high: derivedCounts.high || structuredSummary?.high || selected.high || 0,
    medium: derivedCounts.medium || structuredSummary?.medium || selected.medium || 0,
    low: derivedCounts.low || structuredSummary?.low || selected.low || 0,
  };

  const taintFlow =
    selected?.scan_results?.structured_result?.taint_flow ?? selected?.scan_results?.taint_flow ?? null;
  const taintCounts = {
    sources: taintFlow?.sources ?? 0,
    propagations: taintFlow?.propagations ?? 0,
    sinks: taintFlow?.sinks ?? 0,
  };
  const taintHasData = Object.values(taintCounts).some((value) => value > 0) || (taintFlow?.top_paths?.length ?? 0) > 0;
  const normalizedStatus = (selected?.status || '').toLowerCase();
  const emptyStateMeta = getEmptyStateMeta(normalizedStatus);

  const rawVulnerabilities = useMemo(() => {
    if (summarizedVulnerabilities.length > 0) {
      return summarizedVulnerabilities.map((vuln, idx) => ({
        // We attach idx to map back if needed, though we use vulnerabilitiesWithIndex for the main list
        originalIndex: idx,
        title: vuln.vulnerability_title || vuln.title || '미지정 취약점',
        severity: String(vuln.severity || 'medium').toLowerCase(),
        cwe: vuln.cwe || 'N/A',
        file_path: vuln.file_path || 'N/A',
        line_number: vuln.line_number || 'N/A',
        description: vuln.description || '',
      }));
    }
    return [];
  }, [summarizedVulnerabilities]);

  const vulnerabilityNamesBySeverity = useMemo(() => {
    const buckets = { critical: [], high: [], medium: [], low: [] };
    // Use vulnerabilitiesWithIndex to ensure we have the correct indices
    vulnerabilitiesWithIndex.forEach((vuln) => {
      const severity = SEVERITY_ORDER.includes(vuln.severity) ? vuln.severity : 'medium';
      const title = vuln.vulnerability_title || vuln.title || vuln.description || '미지정 취약점';
      buckets[severity].push({ title, index: vuln.originalIndex });
    });

    // Fallback for pre-computed summary flow if needed (usually vulnerabilitiesWithIndex covers it)
    return buckets;
  }, [vulnerabilitiesWithIndex]);

  const {
    owaspStats,
    owaspMaxCount, // ... rest of the meta logic is identical, omitting for brevity in replace
    attackVectorStats,
    attackTotalCount,
    hotspotStats,
  } = useMemo(() => {
    if (!rawVulnerabilities.length) {
      return {
        owaspStats: [],
        owaspMaxCount: 0,
        attackVectorStats: [],
        attackTotalCount: 0,
        hotspotStats: [],
      };
    }

    const owaspMap = new Map();
    const attackMap = new Map();
    const fileMap = new Map();

    rawVulnerabilities.forEach((vuln) => {
      const severity = SEVERITY_ORDER.includes(vuln.severity) ? vuln.severity : 'medium';
      const normalizedCwe = (vuln.cwe || '').toUpperCase().replace(/\s+/g, '');
      const categoryId = CWE_TO_OWASP[normalizedCwe] || 'OTHER';
      const categoryDef = OWASP_CATEGORY_DEFINITIONS[categoryId] || OWASP_CATEGORY_DEFINITIONS.OTHER;

      if (!owaspMap.has(categoryId)) {
        owaspMap.set(categoryId, {
          id: categoryDef.id,
          name: categoryDef.name,
          color: categoryDef.color,
          iconPath: categoryDef.iconPath,
          count: 0,
        });
      }
      owaspMap.get(categoryId).count += 1;

      const attackRule =
        ATTACK_VECTOR_RULES.find((rule) => rule.match(vuln)) || ATTACK_VECTOR_FALLBACK;
      if (!attackMap.has(attackRule.key)) {
        attackMap.set(attackRule.key, {
          type: attackRule.type,
          label: attackRule.label,
          color: attackRule.color,
          iconPath: attackRule.iconPath,
          count: 0,
        });
      }
      attackMap.get(attackRule.key).count += 1;

      const filePath = vuln.file_path && vuln.file_path !== 'N/A' ? vuln.file_path : null;
      if (filePath) {
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, {
            file: filePath,
            count: 0,
            severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
          });
        }
        const fileEntry = fileMap.get(filePath);
        fileEntry.count += 1;
        if (fileEntry.severityCounts[severity] !== undefined) {
          fileEntry.severityCounts[severity] += 1;
        } else {
          fileEntry.severityCounts.medium += 1;
        }
      }
    });

    const owaspList = Array.from(owaspMap.values())
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
    const owaspMaxCount = owaspList.reduce((max, item) => Math.max(max, item.count), 0);

    const attackList = Array.from(attackMap.values())
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
    const attackTotalCount = attackList.reduce((sum, item) => sum + item.count, 0);
    attackList.forEach((item) => {
      item.total = attackTotalCount;
      item.percentage = attackTotalCount
        ? Math.round((item.count / attackTotalCount) * 100)
        : 0;
    });

    const hotspotList = Array.from(fileMap.values())
      .filter((item) => item.count > 0)
      .map((item) => {
        const severityKey =
          SEVERITY_ORDER.find((level) => item.severityCounts[level] > 0) || 'medium';
        const palette = severityMeta[severityKey] || severityMeta.medium;
        return {
          file: item.file,
          count: item.count,
          severity: severityKey,
          severityLabel: palette.label || severityKey,
          badgePalette: palette,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      owaspStats: owaspList,
      owaspMaxCount,
      attackVectorStats: attackList,
      attackTotalCount,
      hotspotStats: hotspotList,
    };
  }, [rawVulnerabilities]);

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-6 items-start min-w-0">
        <div className="lg:col-span-3 space-y-4">
          <div className={`rounded-lg p-4 ${cardSurface}`}>
            <h5 className={`text-xs font-bold mb-3 uppercase tracking-wide ${headingText}`}>취약점 요약</h5>
            <div className="grid grid-cols-5 gap-2">
              {STAT_CARDS.map((card) => {
                const value = summaryCounts[card.key] ?? 0;
                const isTotal = card.key === 'total';
                const severityMetaEntry = !isTotal ? severityMeta[card.key] || severityMeta.medium : null;

                const baseClass = isTotal
                  ? themed(
                    'bg-indigo-50 text-indigo-700 border border-indigo-200',
                    'bg-indigo-500/20 text-indigo-100 border border-indigo-400/40'
                  )
                  : value > 0
                    ? getSeverityBadge(card.key)
                    : themed(
                      'bg-gray-50 text-gray-500 border border-gray-200',
                      'bg-slate-800/70 text-slate-400 border border-slate-600/70'
                    );

                return (
                  <div key={card.key} className={`rounded-lg px-3 py-2 text-center ${baseClass}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide">{card.label}</div>
                    <div className="text-lg font-bold leading-tight mt-1">{value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`rounded-lg p-3 ${cardSurface}`}>
            <h5 className={`text-xs font-bold mb-2 uppercase tracking-wide ${headingText}`}>스캔 정보</h5>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className={secondaryText}>스캔 유형:</span>
                <span className={`font-semibold ${headingText}`}>{selected.scan_type || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className={secondaryText}>상태:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusBadge(selected.status)}`}>
                  {selected.status?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={secondaryText}>생성 시간:</span>
                <span className={`font-medium text-[10px] ${headingText}`}>
                  {new Date(selected.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
              {selected.updated_at && (
                <div className="flex justify-between">
                  <span className={secondaryText}>수정 시간:</span>
                  <span className={`font-medium text-[10px] ${headingText}`}>
                    {new Date(selected.updated_at).toLocaleString('ko-KR')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {selected.scan_results && (
            <div className={`rounded-lg p-3 ${cardSurface}`}>
              <h5 className={`text-xs font-bold mb-2 uppercase tracking-wide ${headingText}`}>AI 분석</h5>
              <div className="space-y-2 text-xs">
                {selected.scan_results.reasoning && (
                  <div className="flex justify-between">
                    <span className={secondaryText}>분석 과정:</span>
                    <span className={themed('font-semibold text-indigo-700', 'font-semibold text-indigo-200')}>
                      사용 가능
                    </span>
                  </div>
                )}
                {selected.scan_results.usage && (
                  <div className="flex justify-between">
                    <span className={secondaryText}>사용된 토큰:</span>
                    <span className={`font-medium ${headingText}`}>
                      {selected.scan_results.usage.total_tokens || 'N/A'}
                    </span>
                  </div>
                )}
                {selected.scan_results.tool_usage && (
                  <div className="flex justify-between">
                    <span className={secondaryText}>사용된 도구:</span>
                    <span className={`font-medium ${headingText}`}>
                      {selected.scan_results.tool_usage.total_calls || 'N/A'}
                    </span>
                  </div>
                )}
                {selected.scan_results.build_url && (
                  <div className={`pt-1 ${themed('border-t border-gray-200', 'border-t border-slate-700/60')}`}>
                    <a
                      href={selected.scan_results.build_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-[10px] font-medium ${themed(
                        'text-indigo-600 hover:text-indigo-700',
                        'text-indigo-300 hover:text-indigo-200'
                      )}`}
                    >
                      Jenkins 빌드 보기 →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {rawVulnerabilities.length > 0 && (
            <div className={`rounded-lg p-3 ${cardSurface}`}>
              <h5 className={`text-xs font-bold mb-2 uppercase tracking-wide ${headingText}`}>
                발견된 취약점 목록
              </h5>
              <div className="space-y-1.5">
                {['critical', 'high', 'medium', 'low'].map((severity) => {
                  const list = vulnerabilityNamesBySeverity[severity] || [];
                  if (list.length === 0) return null;

                  const meta = severityMeta[severity] || severityMeta.medium;
                  return (
                    <div key={severity}>
                      <div className="flex items-center mb-0.5">
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${themed(
                            meta.badge,
                            meta.darkBadge
                          )}`}
                        >
                          {meta.label}
                        </span>
                        <span className={`ml-1.5 text-[10px] ${mutedText}`}>({list.length})</span>
                      </div>
                      <ul className="space-y-0.5 ml-2">
                        {list.map((item, idx) => (
                          <li key={idx} className={`text-[10px] flex items-start group cursor-pointer ${bodyText}`} onClick={() => scrollToVuln(item.index)}>
                            <span className={themed('text-rose-600 mr-1 group-hover:text-rose-700', 'text-rose-200 mr-1 group-hover:text-rose-100')}>•</span>
                            <span className="line-clamp-1 group-hover:underline group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{item.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 space-y-6 min-w-0">
          {vulnerabilities.length > 0 ? (
            <>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h5 className={`text-lg font-semibold ${headingText}`}>상세 분석 결과</h5>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${mutedText}`}>정렬:</span>
                  {!onSortOptionChange && (
                    <select
                      value={effectiveSortOption}
                      onChange={(e) => handleSortChange(e.target.value)}
                      className={`text-xs rounded-md border px-2 py-1.5 outline-none transition-colors ${themed(
                        'bg-white border-gray-300 text-gray-700 hover:border-indigo-300 focus:border-indigo-500',
                        'bg-slate-800 border-slate-600 text-slate-200 hover:border-slate-500 focus:border-indigo-500'
                      )}`}
                    >
                      {SCAN_SORT_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {sortedVulnerabilities.map((vuln, idx) => {
                  const colors = severityMeta[vuln.severity] || severityMeta.medium;

                  // Code Snippet Extraction
                  let codeSnippet = vuln.code_snippet;
                  const taintFlowData = vuln.taint_flow_analysis || vuln.taint_flow;
                  if (!codeSnippet && taintFlowData && typeof taintFlowData === 'object') {
                    const segments = taintFlowData.segments || [];
                    if (Array.isArray(segments) && segments.length > 0) {
                      const sinkSegment = segments.find((seg) => seg?.stage === 'sink');
                      const firstSegment = segments[0];
                      const targetSegment = sinkSegment || firstSegment;
                      if (targetSegment?.code_snippet) {
                        codeSnippet = String(targetSegment.code_snippet).trim();
                      }
                    }
                    if (!codeSnippet && taintFlowData.code_snippet) {
                      codeSnippet = String(taintFlowData.code_snippet).trim();
                    }
                  }

                  // Remediation Extraction
                  let remediation = vuln.remediation;
                  if (!remediation && vuln.recommendation) {
                    if (typeof vuln.recommendation === 'object') {
                      if (vuln.recommendation.how_to_fix) {
                        const h = String(vuln.recommendation.how_to_fix).trim();
                        if (h) remediation = h.split(/\n+/).map(l => l.trim()).filter(Boolean);
                      }
                      if (!remediation && Array.isArray(vuln.recommendation.steps)) {
                        remediation = vuln.recommendation.steps.map(s => String(s || '').trim()).filter(Boolean);
                      }
                      if (!remediation && Array.isArray(vuln.recommendation)) {
                        remediation = vuln.recommendation.map(item => String(item || '').trim()).filter(Boolean);
                      }
                    } else if (typeof vuln.recommendation === 'string' && vuln.recommendation.trim()) {
                      remediation = vuln.recommendation.split(/\n+/).map(l => l.trim()).filter(Boolean);
                    }
                  }


                  const taintFlowObj = vuln.taint_flow_analysis || vuln.taint_flow;
                  const taintSegments = Array.isArray(taintFlowObj?.segments) ? taintFlowObj.segments : [];
                  // 순서 보장을 위한 가중치
                  const stageOrder = { source: 0, propagation: 1, sink: 2 };

                  const stageSegments = taintSegments
                    .sort((a, b) => {
                      const stageA = String(a.stage || '').toLowerCase();
                      const stageB = String(b.stage || '').toLowerCase();
                      return (stageOrder[stageA] ?? 3) - (stageOrder[stageB] ?? 3);
                    })
                    .map(segment => {
                      const stageKey = String(segment.stage || '').toLowerCase();
                      const meta = TAINT_SEGMENT_META[stageKey];
                      if (!meta || !(segment.description || segment.code_snippet || segment.line_number || segment.title)) {
                        return null;
                      }
                      return { stageKey, segment, meta };
                    })
                    .filter(Boolean);
                  const taintPropagationSteps = Array.isArray(taintFlowObj?.propagation_steps)
                    ? taintFlowObj.propagation_steps
                    : [];
                  return (
                    <div id={`vuln-detail-${vuln.originalIndex}`} key={`${vuln.originalIndex}-${idx}`} className={`rounded-lg overflow-hidden min-w-0 ${cardSurface} scroll-mt-24 transition-all duration-300`}>
                      <div className={`px-5 py-3 border-b ${themed(
                        'bg-white border-gray-200',
                        'bg-slate-900/40 border-slate-700/60'
                      )} min-w-0`}>
                        <div className="flex items-start justify-between min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded ${themed(
                                colors.badge,
                                colors.darkBadge
                              )}`}>
                                {colors.label}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded ${themed(
                                  'bg-gray-100 text-gray-700',
                                  'bg-slate-800/70 text-slate-200 border border-slate-600/70'
                                )}`}
                              >
                                {vuln.cwe}
                              </span>
                            </div>
                            <h6 className={`text-base font-bold ${headingText}`}>{vuln.vulnerability_title || vuln.title}</h6>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        {vuln.file_path !== 'N/A' && (
                          <div>
                            <div className={`text-sm font-semibold uppercase mb-1 ${mutedText}`}>위치</div>
                            <div className="flex items-center gap-2 text-base min-w-0">
                              <code
                                className={`px-2 py-0.5 rounded text-base font-mono break-all ${themed(
                                  'text-indigo-600 bg-indigo-50 border border-indigo-100',
                                  'text-indigo-200 bg-indigo-500/10 border border-indigo-400/40'
                                )}`}
                              >
                                {vuln.file_path}
                              </code>
                              {vuln.line_number !== 'N/A' && (
                                <>
                                  <span className={mutedText}>:</span>
                                  <span className={`${headingText} font-medium text-base`}>{vuln.line_number}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className={`text-sm font-semibold uppercase mb-1 ${mutedText}`}>설명</div>
                          <p className={`text-base leading-relaxed whitespace-pre-line ${bodyText}`}>
                            {vuln.description}
                          </p>
                        </div>

                        {(vuln.taint_flow_analysis || vuln.taint_flow) && (
                          <div
                            className={`${themed(
                              'border border-indigo-100 rounded-lg p-4 space-y-4 min-w-0 bg-[#EAF2FF]',
                              'border border-indigo-400/30 rounded-lg p-4 space-y-4 min-w-0 bg-slate-900/60'
                            )}`}
                          >
                            <div className="flex items-start justify-between flex-wrap gap-2 min-w-0">
                              <div className="min-w-0 flex-1">
                                <span className={themed('text-[13px] font-semibold text-indigo-700 uppercase', 'text-[13px] font-semibold text-indigo-200 uppercase')}>
                                  Taint Flow
                                </span>
                                {taintFlowObj.description && (
                                  <p className={`text-base mt-1 leading-snug break-words ${secondaryText}`}>
                                    {taintFlowObj.description}
                                  </p>
                                )}
                              </div>
                              {taintFlowObj.risk && (
                                <span
                                  className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${getTaintRiskBadge(
                                    taintFlowObj.risk
                                  )}`}
                                >
                                  {taintFlowObj.risk}
                                </span>
                              )}
                            </div>

                            {stageSegments.length > 0 && (
                              <div className="space-y-3">
                                {stageSegments.map(({ stageKey, segment, meta }) => {
                                  const decorated = buildSegmentMeta(stageKey);
                                  return (
                                    <div
                                      key={stageKey}
                                      className={`rounded-lg p-3 space-y-2 shadow-sm ${themed(
                                        'bg-white',
                                        'bg-slate-900/50'
                                      )} ${decorated.border}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${decorated.badge}`}
                                        >
                                          <span className="text-xs font-bold">{meta.label}</span>
                                        </span>
                                        {segment.line_number && (
                                          <span className={`text-xs truncate ${mutedText}`}>{segment.line_number}</span>
                                        )}
                                      </div>

                                      {segment.description && (
                                        <p className={`text-base leading-snug whitespace-pre-line ${bodyText}`}>
                                          {segment.description}
                                        </p>
                                      )}

                                      {segment.code_snippet && (
                                        <CodeSnippet
                                          code={segment.code_snippet}
                                          language="python"
                                          wrapperClass={themed(
                                            'bg-gray-50 border border-gray-200 rounded text-sm font-mono text-gray-800 p-2 leading-snug whitespace-pre-wrap break-words overflow-x-hidden',
                                            'bg-slate-900/70 border border-slate-700 rounded text-sm font-mono text-slate-100 p-2 leading-snug whitespace-pre-wrap break-words overflow-x-hidden'
                                          )}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {taintPropagationSteps.length > 0 && (
                              <div
                                className={`${themed(
                                  'bg-white/70 rounded border border-indigo-100 p-3',
                                  'bg-slate-900/60 rounded border border-indigo-400/30 p-3'
                                )}`}
                              >
                                <div className={`text-base font-semibold mb-2 ${mutedText}`}>전파 단계 요약</div>
                                <ol className={`space-y-1.5 text-base list-decimal list-inside ${secondaryText}`}>
                                  {taintPropagationSteps.map((step, idxStep) => (
                                    <li key={idxStep} className="leading-snug">{step}</li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {taintSegments.length > 0 && taintSegments.every((seg) => !seg?.code_snippet) && (
                              <div
                                className={`text-base leading-snug rounded p-3 ${themed(
                                  'text-gray-500 bg-white/60 border border-gray-200',
                                  'text-slate-300 bg-slate-900/40 border border-slate-700/60'
                                )}`}
                              >
                                추가적인 코드 스니펫 정보가 필요하다면 스캔 구성을 조정해보세요.
                              </div>
                            )}
                          </div>
                        )}

                        {codeSnippet && (
                          <div>
                            <div className={`text-xs font-semibold uppercase mb-2 ${mutedText}`}>취약한 코드</div>
                            <div className={`${themed(
                              'bg-gray-50 rounded-lg p-4 border border-gray-200',
                              'bg-slate-900/70 rounded-lg p-4 border border-slate-700/70'
                            )}`}>
                              <CodeSnippet
                                code={codeSnippet}
                                language="python"
                                wrapperClass={themed(
                                  'text-[11px] font-mono text-gray-800 overflow-x-hidden whitespace-pre-wrap break-words',
                                  'text-[11px] font-mono text-slate-100 overflow-x-hidden whitespace-pre-wrap break-words'
                                )}
                              />
                            </div>
                          </div>
                        )}

                        {remediation && (
                          <div>
                            <div className={`text-sm font-semibold uppercase mb-2 ${mutedText}`}>조치 방법</div>
                            <ul className={`space-y-1.5 text-base list-disc list-inside ${bodyText}`}>
                              {remediation.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={`text-center py-12 rounded-lg ${cardSurface}`}>
              <div className={emptyStateMeta.iconWrapper}>
                <svg className={emptyStateMeta.iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={emptyStateMeta.iconPath} />
                </svg>
              </div>
              <p className={`text-lg font-semibold mb-2 ${headingText}`}>{emptyStateMeta.title}</p>
              <p className={`text-sm ${secondaryText}`}>
                {emptyStateMeta.description}
              </p>
            </div>
          )}

          {taintHasData && (
            <div className={`rounded-lg p-5 ${cardSurface}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h5 className={`text-sm font-semibold ${headingText}`}>Taint Flow 분석 결과</h5>
                  <p className={`text-xs mt-1 ${mutedText}`}>Source → Propagation → Sink 흐름 요약</p>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded ${themed(
                    'bg-indigo-50 border border-indigo-100 text-indigo-600',
                    'bg-indigo-500/20 border border-indigo-400/40 text-indigo-100'
                  )}`}
                >
                  자동 분석
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {[
                  {
                    label: 'Sources',
                    count: taintCounts.sources,
                    desc: '신뢰되지 않은 데이터 유입 지점',
                    badge: themed('bg-blue-100 text-blue-700', 'bg-blue-500/20 text-blue-200 border border-blue-400/40'),
                    valueClass: themed('text-blue-600', 'text-blue-200'),
                  },
                  {
                    label: 'Propagations',
                    count: taintCounts.propagations,
                    desc: '검증 없이 전달된 경로',
                    badge: themed('bg-purple-100 text-purple-700', 'bg-purple-500/20 text-purple-200 border border-purple-400/40'),
                    valueClass: themed('text-purple-600', 'text-purple-200'),
                  },
                  {
                    label: 'Sinks',
                    count: taintCounts.sinks,
                    desc: '위험 작업 실행 지점',
                    badge: themed('bg-rose-100 text-rose-700', 'bg-rose-500/20 text-rose-200 border border-rose-400/40'),
                    valueClass: themed('text-rose-600', 'text-rose-200'),
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className={`rounded-lg p-4 ${themed(
                      'border border-gray-200 bg-gradient-to-br from-white to-gray-50',
                      'border border-slate-700/60 bg-slate-900/40'
                    )}`}
                  >
                    <div className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded ${card.badge}`}>
                      {card.label}
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={`text-2xl font-black ${card.valueClass}`}>{card.count}</span>
                      <span className={`text-xs ${mutedText}`}>개</span>
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed ${secondaryText}`}>{card.desc}</p>
                  </div>
                ))}
              </div>

              {taintFlow?.top_paths?.length > 0 && (
                <div className={`${themed('border-t border-gray-200', 'border-t border-slate-700/60')} pt-4`}>
                  <h6 className={`text-xs font-semibold mb-3 ${headingText}`}>위험도가 높은 데이터 흐름</h6>
                  <div className="space-y-2">
                    {taintFlow.top_paths.slice(0, 5).map((path, idx) => {
                      const riskBadge = getTaintRiskBadge(path.risk);
                      return (
                        <div
                          key={`${path.source}-${path.sink}-${idx}`}
                          className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg px-3 py-2 ${themed(
                            'border border-gray-200 bg-white',
                            'border border-slate-700/60 bg-slate-900/40'
                          )}`}
                        >
                          <div>
                            <p className={`text-xs font-semibold ${headingText}`}>
                              {path.source} <span className={mutedText}>→</span> {path.sink}
                            </p>
                            {path.description && (
                              <p className={`text-xs mt-1 leading-snug ${secondaryText}`}>{path.description}</p>
                            )}
                          </div>
                          <span className={`text-[10px] font-semibold uppercase px-2 py-1 rounded ${riskBadge}`}>
                            {path.risk}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-200 pt-6 mt-6">
            <h5 className={`text-sm font-semibold mb-4 ${headingText}`}>고급 분석 및 통계</h5>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className={`rounded-xl p-5 ${cardSurface} hover:shadow-lg transition-shadow`}>
                <div className="mb-4">
                  <h6 className={`text-sm font-bold ${headingText}`}>OWASP Top 10 매핑</h6>
                  <p className={`text-xs mt-1 ${secondaryText}`}>업계 표준 보안 위험 분류</p>
                </div>
                {owaspStats.length > 0 ? (
                  <div className="space-y-2.5">
                    {owaspStats.map((item, idx) => {
                      const colorMeta = OWASP_COLOR_META[item.color] || OWASP_COLOR_META.default;
                      const percentage = owaspMaxCount ? (item.count / owaspMaxCount) * 100 : 0;
                      return (
                        <div key={idx} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded flex items-center justify-center ${colorMeta.iconBg}`}>
                                <svg className={`w-3.5 h-3.5 ${colorMeta.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
                                </svg>
                              </div>
                              <span className={`text-xs font-semibold ${headingText}`}>{item.id}</span>
                              <span className={`text-xs truncate ${secondaryText}`}>{item.name}</span>
                            </div>
                            <span className={`text-xs font-bold ${headingText}`}>{item.count}</span>
                          </div>
                          <div className={`h-2.5 rounded-full overflow-hidden shadow-inner ${themed(
                            'bg-gray-200',
                            'bg-slate-800'
                          )}`}>
                            <div
                              className={`h-full bg-gradient-to-r ${colorMeta.barGradient} rounded-full transition-all duration-500 group-hover:shadow-lg shadow-md`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-xs ${secondaryText}`}>OWASP 매핑을 계산할 취약점 데이터가 없습니다.</p>
                )}
              </div>

              <div className={`rounded-xl p-5 ${cardSurface} hover:shadow-lg transition-shadow`}>
                <div className="mb-4">
                  <h6 className={`text-sm font-bold ${headingText}`}>공격 벡터 분석</h6>
                  <p className={`text-xs mt-1 ${secondaryText}`}>취약점 유형별 분포</p>
                </div>
                {attackVectorStats.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {attackVectorStats.map((item, idx) => {
                      const colorMeta = ATTACK_COLOR_META[item.color] || ATTACK_COLOR_META.default;
                      const percentage = item.percentage ?? (item.total ? Math.round((item.count / item.total) * 100) : 0);
                      return (
                        <div
                          key={idx}
                          className={`${themed(colorMeta.card, 'bg-slate-900/40 border border-slate-700/60')} rounded-lg p-3 hover:shadow-md transition-all`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${themed(
                              colorMeta.iconBg,
                              'bg-slate-800/70 border border-slate-600/70'
                            )}`}>
                              <svg className={`w-6 h-6 ${themed(colorMeta.icon, 'text-slate-200')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
                              </svg>
                            </div>
                            <span className={`text-lg font-bold ${themed(colorMeta.count, 'text-slate-100')}`}>
                              {item.count}
                            </span>
                          </div>
                          <div className={`text-xs font-semibold mb-1 ${headingText}`}>{item.type}</div>
                          <div className="flex items-center gap-2">
                            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${themed(
                              'bg-gray-200',
                              'bg-slate-800'
                            )}`}>
                              <div className={`h-full rounded-full ${themed(colorMeta.bar, 'bg-slate-200')}`} style={{ width: `${percentage}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${secondaryText}`}>{percentage}%</span>
                          </div>
                          <p className={`text-xs mt-1 leading-relaxed ${secondaryText}`}>{item.label}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-xs ${secondaryText}`}>공격 벡터 통계를 생성할 취약점이 없습니다.</p>
                )}
              </div>

              <div className={`rounded-xl p-5 ${cardSurface} hover:shadow-lg transition-shadow`}>
                <div className="mb-4">
                  <h6 className={`text-sm font-bold ${headingText}`}>Hotspot 분석</h6>
                  <p className={`text-xs mt-1 ${secondaryText}`}>취약점이 발견된 파일 목록</p>
                </div>
                {hotspotStats.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {hotspotStats.map((item, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg p-3 ${themed(
                          'bg-gray-50 border border-gray-200',
                          'bg-slate-900/40 border border-slate-700/60'
                        )}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold truncate ${headingText}`}>{item.file}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${themed(
                              item.badgePalette?.badge,
                              item.badgePalette?.darkBadge
                            )}`}
                          >
                            {item.severityLabel}
                          </span>
                        </div>
                        <p className={`text-xs ${secondaryText}`}>{item.count}개 발견</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-xs ${secondaryText}`}>Hotspot 분석을 표시할 취약점이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScanSummaryPanel;
