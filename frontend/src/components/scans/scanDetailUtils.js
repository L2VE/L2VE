export const severityMeta = {
  critical: {
    badge: 'bg-rose-100 text-rose-700',
    darkBadge: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
    label: '위험'
  },
  high: {
    badge: 'bg-orange-100 text-orange-700',
    darkBadge: 'bg-orange-500/20 text-orange-200 border border-orange-400/40',
    label: '높음'
  },
  medium: {
    badge: 'bg-amber-100 text-amber-700',
    darkBadge: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
    label: '중간'
  },
  low: {
    badge: 'bg-yellow-100 text-yellow-700',
    darkBadge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
    label: '낮음'
  },
};

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

export const SCAN_SORT_OPTIONS = [
  { key: 'severity', label: '위험도순', icon: 'M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }, // clock/priority
  { key: 'type', label: '취약점 유형순', icon: 'M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4' }, // list/sort by type
  { key: 'title', label: '제목순', icon: 'M4 6h16M4 10h10m-6 4h12m-8 4h8' }, // text
  { key: 'location', label: '위치순', icon: 'M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7zm0 9a2 2 0 100-4 2 2 0 000 4z' }, // pin
];

const severityMap = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  긴급: 'critical',
  높음: 'high',
  높은: 'high',
  중간: 'medium',
  보통: 'medium',
  낮음: 'low',
  낮은: 'low',
};

const TAINT_RISK_LEVELS = ['critical', 'high', 'medium', 'low'];
const DEFAULT_TAINT_FLOW = {
  source: 'N/A',
  sink: 'N/A',
  risk: null,
  description: '',
  propagation_steps: [],
  segments: [],
};

function toTrimmedString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizePropagationSteps(steps) {
  if (!steps) return [];
  const list = Array.isArray(steps) ? steps : [steps];
  return list
    .map((step) => {
      if (typeof step === 'string' || typeof step === 'number') {
        return toTrimmedString(step);
      }
      if (step && typeof step === 'object') {
        for (const key of ['description', 'detail', 'title', 'summary', 'text']) {
          if (step[key]) {
            return toTrimmedString(step[key]);
          }
        }
        return toTrimmedString(JSON.stringify(step));
      }
      return '';
    })
    .filter(Boolean);
}

function normalizeFilePath(filePath) {
  if (!filePath || filePath === 'N/A' || typeof filePath !== 'string') {
    return filePath || '';
  }
  return filePath
    .replace(/^\/home\/ubuntu\/jg\/vulnshop\//, '')
    .replace(/^\/home\/ubuntu\/jg\//, '')
    .replace(/^\/.*?\/vulnshop\//, '')
    .replace(/^\/.*?\/jg\/vulnshop\//, '')
    .replace(/^\/+/, '') || '';
}

export function sortVulnerabilitiesByOption(list, sortOption = 'severity') {
  if (!Array.isArray(list)) return [];

  const items = [...list];
  items.sort((a, b) => {
    if (sortOption === 'severity') {
      const orderA = SEVERITY_ORDER.indexOf(a.severity);
      const orderB = SEVERITY_ORDER.indexOf(b.severity);
      const idxA = orderA === -1 ? 2 : orderA;
      const idxB = orderB === -1 ? 2 : orderB;
      if (idxA !== idxB) return idxA - idxB;
    } else if (sortOption === 'type') {
      const typeA = (a.cwe || '').toString();
      const typeB = (b.cwe || '').toString();
      if (typeA !== typeB) return typeA.localeCompare(typeB);
    } else if (sortOption === 'title') {
      const titleA = (a.vulnerability_title || a.title || '').toString();
      const titleB = (b.vulnerability_title || b.title || '').toString();
      return titleA.localeCompare(titleB);
    } else if (sortOption === 'location') {
      const fileA = (a.file_path || '').toString();
      const fileB = (b.file_path || '').toString();
      if (fileA !== fileB) return fileA.localeCompare(fileB);
      const lineA = parseInt(a.line_number || a.line_num, 10) || 0;
      const lineB = parseInt(b.line_number || b.line_num, 10) || 0;
      if (lineA !== lineB) return lineA - lineB;
    }
    return 0;
  });

  return items;
}

function normalizeTaintSegment(segment, fallbackStage = 'propagation') {
  if (!segment && segment !== 0) {
    return null;
  }

  if (typeof segment === 'string' || typeof segment === 'number') {
    const text = toTrimmedString(segment);
    if (!text) return null;
    return {
      stage: fallbackStage,
      title: text,
      line_number: '',
      file_path: '',
      description: text,
      code_snippet: '',
    };
  }

  if (typeof segment !== 'object') {
    return null;
  }

  let stage = toTrimmedString(segment.stage || fallbackStage || 'propagation').toLowerCase();
  if (!['source', 'propagation', 'sink'].includes(stage)) {
    stage = 'propagation';
  }

  const rawFilePath = toTrimmedString(segment.file_path || segment.path);
  return {
    stage,
    title: toTrimmedString(segment.title || segment.label || segment.name || segment.description),
    line_number: toTrimmedString(segment.line_number || segment.line || segment.line_num),
    file_path: normalizeFilePath(rawFilePath),
    description: toTrimmedString(segment.description || segment.explanation || segment.detail),
    code_snippet: toTrimmedString(segment.code_snippet || segment.code),
  };
}

function deriveStageLabelFromData(rawStage, segments, stageKey) {
  if (typeof rawStage === 'string' && rawStage.trim()) {
    return rawStage.trim();
  }
  if (rawStage && typeof rawStage === 'object') {
    for (const key of ['title', 'label', 'name', 'description']) {
      if (rawStage[key]) {
        return toTrimmedString(rawStage[key]);
      }
    }
  }

  const matchedSegment = (segments || []).find((seg) => seg?.stage === stageKey && seg.title);
  if (matchedSegment) {
    return matchedSegment.title;
  }
  return '';
}

function normalizeTaintFlowPayload(rawTaint) {
  if (!rawTaint && rawTaint !== 0) {
    return { ...DEFAULT_TAINT_FLOW };
  }

  if (typeof rawTaint === 'string' || typeof rawTaint === 'number') {
    const text = toTrimmedString(rawTaint);
    if (!text) {
      return { ...DEFAULT_TAINT_FLOW };
    }
    return {
      ...DEFAULT_TAINT_FLOW,
      source: text,
      description: text,
    };
  }

  if (typeof rawTaint !== 'object') {
    return { ...DEFAULT_TAINT_FLOW };
  }

  const result = {
    ...DEFAULT_TAINT_FLOW,
    description: toTrimmedString(rawTaint.description),
  };

  const risk = toTrimmedString(rawTaint.risk).toLowerCase();
  result.risk = TAINT_RISK_LEVELS.includes(risk) ? risk : null;

  result.propagation_steps = normalizePropagationSteps(
    rawTaint.propagation_steps || rawTaint.propagation || rawTaint.steps
  );

  let segments = [];
  if (Array.isArray(rawTaint.segments) && rawTaint.segments.length > 0) {
    segments = rawTaint.segments
      .map((segment) => normalizeTaintSegment(segment, segment?.stage))
      .filter(Boolean);
  } else {
    const sourceSegment = normalizeTaintSegment(rawTaint.source, 'source');
    if (sourceSegment) segments.push(sourceSegment);

    const propagationPayload = rawTaint.propagation || rawTaint.propagation_steps;
    if (Array.isArray(propagationPayload)) {
      propagationPayload
        .map((step) => normalizeTaintSegment(step, 'propagation'))
        .filter(Boolean)
        .forEach((segment) => segments.push(segment));
    } else {
      const propagationSegment = normalizeTaintSegment(propagationPayload, 'propagation');
      if (propagationSegment) segments.push(propagationSegment);
    }

    const sinkSegment = normalizeTaintSegment(rawTaint.sink, 'sink');
    if (sinkSegment) segments.push(sinkSegment);
  }

  result.segments = segments;
  result.source = deriveStageLabelFromData(rawTaint.source, segments, 'source') || 'N/A';
  result.sink = deriveStageLabelFromData(rawTaint.sink, segments, 'sink') || 'N/A';

  return result;
}

function toSeverity(value, fallback = 'medium') {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return severityMap[normalized] || fallback;
}

export function normalizeScanSummary(scan) {
  if (!scan || typeof scan !== 'object') {
    return scan;
  }

  const summary = scan?.scan_results?.structured_result?.scan_summary;

  const nextCritical = Number(scan.critical ?? summary?.critical ?? 0);
  const nextHigh = Number(scan.high ?? summary?.high ?? 0);
  const nextMedium = Number(scan.medium ?? summary?.medium ?? 0);
  const nextLow = Number(scan.low ?? summary?.low ?? 0);
  const inferredTotal =
    Number(scan.vulnerabilities_found ?? summary?.total_findings ?? 0) ||
    nextCritical + nextHigh + nextMedium + nextLow;

  return {
    ...scan,
    vulnerabilities_found: inferredTotal,
    critical: nextCritical,
    high: nextHigh,
    medium: nextMedium,
    low: nextLow,
  };
}

export function normalizePipelineData(data) {
  if (!data) {
    return {
      available: false,
      summary: {},
      stages: [],
      build_info: null,
      errors: [],
      warnings: [],
      message: null,
    };
  }

  return {
    available: data.available !== undefined ? data.available : true,
    summary: data.summary || {},
    stages: data.stages || [],
    build_info: data.build_info || null,
    errors: data.errors || [],
    warnings: data.warnings || [],
    message: data.message || null,
  };
}

// function extractDescription(sectionBody) {
//   const descPattern1 = /-\s*\*{0,2}설명\*{0,2}[:\s]*(.+?)(?=\n\s*-\s*\*{0,2}[가-힣A-Za-z]+\*{0,2}:|$)/is;
//   const descMatch1 = sectionBody.match(descPattern1);
//   if (descMatch1) {
//     return descMatch1[1].trim();
//   }

//   const descPattern2 = /\*{0,2}취약점\s*설명\*{0,2}[:\s]*\n((?:\s*[-•]\s*.+\n?)+)/i;
//   const descMatch2 = sectionBody.match(descPattern2);
//   if (descMatch2) {
//     return descMatch2[1]
//       .split('\n')
//       .map((line) => line.replace(/^\s*[-•]\s*/, '').trim())
//       .filter((line) => line.length > 0)
//       .join('\n');
//   }

//   const impactPattern = /\*{0,2}영향\*{0,2}[:\s]*([^\n]+)/i;
//   const impactMatch = sectionBody.match(impactPattern);
//   if (impactMatch) {
//     return impactMatch[1].trim();
//   }

//   const lines = sectionBody
//     .split('\n')
//     .filter((line) => !line.match(/^\s*-\s*\*{0,2}(위치|라인|코드|심각도|조치)/i))
//     .map((line) => line.trim())
//     .filter(Boolean);

//   const mainContent = lines.join(' ');
//   if (mainContent.length === 0) return '';
//   return mainContent.substring(0, 300) + (mainContent.length > 300 ? '...' : '');
// }

// function extractCodeSnippet(sectionBody) {
//   const codeMatch1 = sectionBody.match(/```[\w]*\n([\s\S]*?)```/);
//   if (codeMatch1) {
//     return codeMatch1[1].trim();
//   }

//   const codeMatch2 = sectionBody.match(/-\s*\*{0,2}코드\*{0,2}[:\s]*`([^`]+)`/i);
//   if (codeMatch2) {
//     return codeMatch2[1].trim();
//   }

//   return null;
// }

// function extractRemediation(sectionBody) {
//   const remPattern = /\*{0,2}조치\s*방법\*{0,2}[:\s]*\n((?:\s*[-•]\s*.+\n?)+)/i;
//   const remMatch = sectionBody.match(remPattern);
//   if (!remMatch) return null;

//   return remMatch[1]
//     .split('\n')
//     .map((line) => line.replace(/^\s*[-•]\s*/, '').trim())
//     .filter((line) => line.length > 0)
//     .join('\n');
// }

export function collectVulnerabilities(content, vulnerabilityNames = { critical: [], high: [], medium: [], low: [] }) {
  if (!content) {
    return [];
  }

  let parsedJson = null;
  if (typeof content === 'string' && content.trim().startsWith('{')) {
    try {
      parsedJson = JSON.parse(content);
    } catch (err) {
      parsedJson = null;
    }
  } else if (typeof content === 'object' && content !== null) {
    parsedJson = content;
  }

  if (parsedJson && Array.isArray(parsedJson.vulnerabilities)) {
    return parsedJson.vulnerabilities.map((vuln) => {
      const title = vuln.vulnerability_title || vuln.title || '';
      const normalizedTaint = normalizeTaintFlowPayload(vuln.taint_flow_analysis || vuln.taint_flow);

      const remediationItems = Array.isArray(vuln.remediation)
        ? vuln.remediation.map((item) => String(item || '').trim()).filter(Boolean)
        : String(vuln.remediation || '')
          .split(/\n+/)
          .map((item) => item.trim())
          .filter(Boolean);

      const patch = vuln.patch && typeof vuln.patch === 'object'
        ? vuln.patch
        // ? {
        //     summary: String(vuln.patch.summary || '').trim(),
        //     steps: Array.isArray(vuln.patch.steps)
        //       ? vuln.patch.steps.map((step) => String(step || '').trim()).filter(Boolean)
        //       : [],
        //     code_diff: String(vuln.patch.code_diff || '').trim(),
        //     references: Array.isArray(vuln.patch.references)
        //       ? vuln.patch.references.map((ref) => String(ref || '').trim()).filter(Boolean)
        //       : [],
        //     code_context: String(vuln.patch.code_context || '').trim(),
        //     code_context_range:
        //       vuln.patch.code_context_range && typeof vuln.patch.code_context_range === 'object'
        //         ? vuln.patch.code_context_range
        //         : null,
        //   }
        : {
          summary: '',
          steps: [],
          code_diff: '',
          references: [],
          code_context: '',
          code_context_range: null,
        };

      const rawFilePath = String(vuln.file_path || 'N/A').trim();
      return {
        title: String(title || '').trim(),
        severity: String(vuln.severity || 'medium').trim().toLowerCase(),
        cwe: String(vuln.cwe || 'N/A').trim(),
        file_path: rawFilePath === 'N/A' ? 'N/A' : normalizeFilePath(rawFilePath) || 'N/A',
        line_number: String(vuln.line_number || 'N/A').trim(),
        description: String(vuln.description || '').trim(),
        code_snippet: vuln.code_snippet ? String(vuln.code_snippet).trim() : null,
        remediation: remediationItems,
        patch,
        taint_flow: normalizedTaint,
      };
    });
  }

  // const normalizedContent = content.replace(/\r\n/g, '\n');
  // const sectionPattern = /(?:^|\n)\s*(\d+)\.\s*\*{0,2}(.+?)\*{0,2}\s*\n([\s\S]*?)(?=\n\s*\d+\.\s*\*{0,2}|$)/g;
  // const sections = [];
  // let match;

  // while ((match = sectionPattern.exec(normalizedContent)) !== null) {
  //   const rawTitle = match[2].trim();
  //   const body = match[3].trim();

  //   if (!rawTitle) continue;

  // const severityInTitle = rawTitle.match(/\((Critical|High|Medium|Low|긴급|높음|중간|낮음)\)/i);
  // const severity = severityInTitle ? toSeverity(severityInTitle[1]) : (() => {
  //   const severityMatch = body.match(/-\s*\*{0,2}심각도\*{0,2}\s*:\s*\*{0,2}(Critical|High|Medium|Low|긴급|높음|중간|낮음)\*{0,2}/i);
  //   return severityMatch ? toSeverity(severityMatch[1]) : 'medium';
  // })();

  // const cleanTitle = rawTitle
  //   .replace(/\((Critical|High|Medium|Low|긴급|높음|중간|낮음)\)/i, '')
  //   .replace(/취약점/gi, '')
  //   .replace(/\s+/g, ' ')
  //   .trim();

  // const filePathMatch =
  //   body.match(/\*{0,2}위치\*{0,2}[:\s]*`([^`]+)`/i) ||
  //   body.match(/\*{0,2}파일명\*{0,2}[:\s]*`([^`]+)`/i) ||
  //   body.match(/\*{0,2}파일\*{0,2}[:\s]*`([^`]+)`/i) ||
  //   body.match(/`([^`]+\.(?:py|js|ts|tsx|jsx|java|go|rs))`/i);

  // const lineNumberMatch =
  //   body.match(/Line\s+(\d+[-\d]*)/i) ||
  //   body.match(/(\d+[-\d]*)\s*라인/i) ||
  //   body.match(/라인[:\s]*(\d+[-\d]*)/i);

  // const cweMatch = body.match(/(CWE-\d+)/i);
  // const description = extractDescription(body);
  // const codeSnippet = extractCodeSnippet(body);
  // const remediation = extractRemediation(body);

  // const remediationItems = remediation
  //   ? remediation
  //     .split(/\n+/)
  //     .map((item) => item.trim())
  //     .filter(Boolean)
  //   : [];

  //   sections.push({
  //     title: cleanTitle || rawTitle,
  //     severity,
  //     cwe: cweMatch ? cweMatch[1] : 'N/A',
  //     file_path: filePathMatch ? filePathMatch[1] : 'N/A',
  //     line_number: lineNumberMatch ? lineNumberMatch[1] : 'N/A',
  //     description: description || `${cleanTitle || rawTitle}에 대한 상세 정보는 스캔 결과를 확인하세요.`,
  //     code_snippet: codeSnippet,
  //     remediation: remediationItems,
  //     patch: {
  //       summary: `${cleanTitle || rawTitle} 취약점을 해결하기 위한 패치 전략을 검토하세요.`,
  //       steps: remediationItems.length > 0 ? remediationItems : ['구체적인 조치 방안을 검토하세요.'],
  //       code_diff: codeSnippet || '패치 예시는 추가 분석이 필요합니다.',
  //       references: [],
  //       code_context: '',
  //       code_context_range: null,
  //     },
  //     taint_flow: {
  //       source: 'N/A',
  //       sink: 'N/A',
  //       risk: null,
  //       description: '',
  //       propagation_steps: [],
  //       segments: [],
  //     },
  //   });
  // }

  // if (sections.length > 0) {
  //   return sections;
  // }

  // const severityOrder = ['critical', 'high', 'medium', 'low'];
  const fallback = [];

  // severityOrder.forEach((severity) => {
  //   (vulnerabilityNames[severity] || []).forEach((title) => {
  //     fallback.push({
  //       title,
  //       severity,
  //       cwe: 'N/A',
  //       file_path: 'N/A',
  //       line_number: 'N/A',
  //       description: `${title}에 대한 상세 정보는 스캔 결과를 확인하세요.`,
  //       code_snippet: null,
  //       remediation: [],
  //       patch: {
  //         summary: `${title} 취약점에 대한 패치 전략을 추가로 정의하세요.`,
  //         steps: ['적절한 패치 단계를 수립하세요.', '코드 변경 사항을 검토하여 적용하세요.'],
  //         code_diff: '패치 코드 예시는 아직 제공되지 않았습니다.',
  //         references: [],
  //         code_context: '',
  //         code_context_range: null,
  //       },
  //       taint_flow: {
  //         source: 'N/A',
  //         sink: 'N/A',
  //         risk: null,
  //         description: '',
  //         propagation_steps: [],
  //         segments: [],
  //       },
  //     });
  //   });
  // });

  return fallback;
}
