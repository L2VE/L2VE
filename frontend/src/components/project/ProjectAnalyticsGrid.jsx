import React, { useMemo } from 'react';
import { cardClass, softCardClass, mutedText } from '../../utils/themeStyles';
import { collectVulnerabilities } from '../scans/scanDetailUtils';

const severityOrder = ['critical', 'high', 'medium', 'low'];

const severityPalette = {
  critical: {
    light: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-600', bar: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700' },
    dark: { bg: 'bg-rose-500/20', border: 'border-rose-400/40', text: 'text-rose-200', bar: 'bg-rose-400', chip: 'bg-rose-400/20 text-rose-200' },
  },
  high: {
    light: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-600', bar: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700' },
    dark: { bg: 'bg-orange-500/20', border: 'border-orange-400/40', text: 'text-orange-200', bar: 'bg-orange-400', chip: 'bg-orange-400/20 text-orange-200' },
  },
  medium: {
    light: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-600', bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700' },
    dark: { bg: 'bg-amber-500/20', border: 'border-amber-400/40', text: 'text-amber-200', bar: 'bg-amber-400', chip: 'bg-amber-400/20 text-amber-200' },
  },
  low: {
    light: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-600', bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
    dark: { bg: 'bg-emerald-500/20', border: 'border-emerald-400/40', text: 'text-emerald-200', bar: 'bg-emerald-400', chip: 'bg-emerald-400/20 text-emerald-200' },
  },
  default: {
    light: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-600', bar: 'bg-gray-400', chip: 'bg-gray-100 text-gray-700' },
    dark: { bg: 'bg-gray-500/20', border: 'border-gray-400/40', text: 'text-gray-200', bar: 'bg-gray-400', chip: 'bg-gray-400/20 text-gray-200' },
  },
};

const formatShortDate = (date) => {
  if (!date || Number.isNaN(date.valueOf())) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
};

const safeNumber = (value) => (typeof value === 'number' && !Number.isNaN(value) ? value : 0);

const dominantSeverity = (severityCounts) => {
  if (!severityCounts) return 'default';
  return severityOrder.find((level) => (severityCounts[level] || 0) > 0) || 'default';
};

function ProjectAnalyticsGrid({ isDark, scans, trendSummaryCards, vulnerabilities: providedVulnerabilities = [] }) {
  const sectionHeadingClass = `text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} leading-tight`;
  const sectionSubtextClass = `text-xs ${mutedText(isDark)} mt-1 leading-tight`;

  const analytics = useMemo(() => {
    const result = {
      severityTrend: [],
      severityMax: 1,
      activityTrend: [],
      activityMax: 1,
      vulnerabilityTypes: [],
      typeMax: 0,
      topCwe: [],
      topCweMax: 0,
      topFiles: [],
      topFileMax: 0,
      totalVulnerabilities: 0,
    };

    if (!Array.isArray(scans) || scans.length === 0) {
      return result;
    }

    const parseCompletedDate = (scan) => {
      const value = scan.completed_at || scan.started_at || scan.created_at;
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.valueOf()) ? null : date;
    };

    const completed = scans
      .map((scan) => ({
        scan,
        completedAt: parseCompletedDate(scan),
      }))
      .filter((entry) => entry.completedAt)
      .sort((a, b) => a.completedAt - b.completedAt);

    if (completed.length === 0) {
      return result;
    }

    const recent = completed.slice(-10);
    result.severityTrend = recent.map(({ scan, completedAt }) => ({
      id: scan.id,
      label: formatShortDate(completedAt),
      display: formatShortDate(completedAt),
      critical: safeNumber(scan.critical),
      high: safeNumber(scan.high),
      medium: safeNumber(scan.medium),
      low: safeNumber(scan.low),
      total: safeNumber(scan.vulnerabilities_found),
    }));

    result.severityMax = Math.max(
      1,
      ...result.severityTrend.flatMap((entry) => [entry.critical, entry.high, entry.medium, entry.low])
    );

    result.activityTrend = recent.map(({ scan, completedAt }) => ({
      id: scan.id,
      label: formatShortDate(completedAt),
      display: formatShortDate(completedAt),
      total: safeNumber(scan.vulnerabilities_found),
    }));
    result.activityMax = Math.max(1, ...result.activityTrend.map((entry) => entry.total));

    // 백엔드 DB에서 가져온 정규화/중복 제거된 취약점이 전달되면 그대로 사용
    const vulnerabilities = providedVulnerabilities.length ? [...providedVulnerabilities] : [];

    // 없을 경우에만 fallback: scan_results에서 파싱
    if (vulnerabilities.length === 0) {
      completed.forEach(({ scan }) => {
        const scanResults = scan.scan_results;
        if (!scanResults) return;

        let extracted = [];
        if (scanResults.structured_result?.vulnerabilities?.length) {
          extracted = collectVulnerabilities(scanResults.structured_result);
        } else if (scanResults.content || scanResults.vulnerability_names) {
          extracted = collectVulnerabilities(scanResults.content, scanResults.vulnerability_names);
        }

        extracted
          .filter((vuln) => vuln && typeof vuln === 'object')
          .forEach((vuln) => {
            const severity = severityOrder.includes(vuln.severity) ? vuln.severity : 'medium';
            vulnerabilities.push({
              ...vuln,
              severity,
              scanId: scan.id,
            });
          });
      });
    }

    // Deduplicate vulnerabilities similar to backend (file_path + line range, fallback title)
    const dedupedVulnerabilities = (() => {
      const severityPriority = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };
      const map = new Map();

      const extractLineNumbers = (vuln) => {
        const lines = [];
        const pushLines = (value) => {
          if (!value) return;
          const matches = String(value).match(/\d+/g);
          if (matches) {
            lines.push(...matches.map(Number));
          }
        };
        pushLines(vuln.line_number || vuln.line_num);
        const tf = vuln.taint_flow_analysis || vuln.taint_flow;
        if (tf) {
          pushLines(tf.line_number || tf.line);
          ['source', 'sink', 'propagation'].forEach((key) => {
            const seg = tf[key];
            if (seg && typeof seg === 'object') {
              pushLines(seg.line_number || seg.line);
            }
          });
          if (Array.isArray(tf.segments)) {
            tf.segments.forEach((seg) => {
              if (seg && typeof seg === 'object') {
                pushLines(seg.line_number || seg.line);
              }
            });
          }
        }
        const unique = Array.from(new Set(lines)).sort((a, b) => a - b);
        return unique;
      };

      vulnerabilities.forEach((vuln) => {
        const file = (vuln.file_path || '').toLowerCase();
        if (!file || file === 'n/a') return;
        const lineNumbers = extractLineNumbers(vuln);
        const lineRange =
          lineNumbers.length > 1
            ? `${lineNumbers[0]}-${lineNumbers[lineNumbers.length - 1]}`
            : lineNumbers.length === 1
              ? String(lineNumbers[0])
              : null;
        const titleNormalized = String(vuln.title || vuln.vulnerability_title || vuln.description || '')
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .trim()
          .slice(0, 50);
        const key = lineRange ? `${file}|${lineRange}` : `${file}|${titleNormalized}`;

        const existing = map.get(key);
        const severity = severityOrder.includes(vuln.severity) ? vuln.severity : 'medium';
        const currentPriority = severityPriority[severity] || 99;
        if (!existing) {
          map.set(key, { ...vuln, severity });
        } else {
          const existingPriority = severityPriority[existing.severity] || 99;
          if (currentPriority < existingPriority) {
            map.set(key, { ...vuln, severity });
          }
        }
      });

      return Array.from(map.values());
    })();

    result.totalVulnerabilities = dedupedVulnerabilities.length;

    const typeMap = new Map();
    dedupedVulnerabilities.forEach((vuln) => {
      const key = vuln.title || '기타';
      if (!typeMap.has(key)) {
        typeMap.set(key, {
          count: 0,
          severity: { critical: 0, high: 0, medium: 0, low: 0 },
        });
      }
      const entry = typeMap.get(key);
      entry.count += 1;
      if (entry.severity[vuln.severity] !== undefined) {
        entry.severity[vuln.severity] += 1;
      } else {
        entry.severity.medium += 1;
      }
    });

    const sortedTypes = Array.from(typeMap.entries()).sort((a, b) => b[1].count - a[1].count);
    result.typeMax = sortedTypes.length > 0 ? sortedTypes[0][1].count : 0;
    result.vulnerabilityTypes = sortedTypes.slice(0, 8).map(([title, entry]) => ({
      title,
      count: entry.count,
      severityCounts: entry.severity,
    }));

    const cweMap = new Map();
    dedupedVulnerabilities.forEach((vuln) => {
      const keyRaw = vuln.cwe && vuln.cwe !== 'N/A' ? vuln.cwe : 'CWE-UNKNOWN';
      if (!cweMap.has(keyRaw)) {
        cweMap.set(keyRaw, {
          count: 0,
          severity: { critical: 0, high: 0, medium: 0, low: 0 },
          sampleTitle: vuln.title || '',
        });
      }
      const entry = cweMap.get(keyRaw);
      entry.count += 1;
      if (entry.severity[vuln.severity] !== undefined) {
        entry.severity[vuln.severity] += 1;
      } else {
        entry.severity.medium += 1;
      }
      if (!entry.sampleTitle && vuln.title) {
        entry.sampleTitle = vuln.title;
      }
    });

    const sortedCwe = Array.from(cweMap.entries()).sort((a, b) => b[1].count - a[1].count);
    result.topCweMax = sortedCwe.length > 0 ? sortedCwe[0][1].count : 0;
    result.topCwe = sortedCwe.slice(0, 5).map(([cwe, entry]) => ({
      cwe,
      count: entry.count,
      severityCounts: entry.severity,
      sampleTitle: entry.sampleTitle,
    }));

    const fileMap = new Map();
    dedupedVulnerabilities.forEach((vuln) => {
      const path = vuln.file_path;
      if (!path || path === 'N/A') return;
      if (!fileMap.has(path)) {
        fileMap.set(path, {
          count: 0,
          severity: { critical: 0, high: 0, medium: 0, low: 0 },
        });
      }
      const entry = fileMap.get(path);
      entry.count += 1;
      if (entry.severity[vuln.severity] !== undefined) {
        entry.severity[vuln.severity] += 1;
      } else {
        entry.severity.medium += 1;
      }
    });

    const sortedFiles = Array.from(fileMap.entries()).sort((a, b) => b[1].count - a[1].count);
    result.topFileMax = sortedFiles.length > 0 ? sortedFiles[0][1].count : 0;
    result.topFiles = sortedFiles.slice(0, 5).map(([file, entry]) => ({
      file,
      count: entry.count,
      severityCounts: entry.severity,
    }));

    return result;
  }, [scans, providedVulnerabilities]);

  return (
    <>
      {/* <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
        <div className={`xl:col-span-3 ${cardClass(isDark, 'p-8 hover:shadow-lg transition-shadow border-gray-300', 'p-8 hover:border-gray-600 hover:shadow-cyan-500/10')}`}>
          <div className="mb-6 flex items-center justify-between">
            <div className="h-12 flex flex-col justify-center">
              <h3 className={sectionHeadingClass}>심각도별 발견 추이</h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1 leading-tight`}>최근 10회 스캔의 심각도별 취약점 수</p>
            </div>
            <div className="flex items-center space-x-3">
              {[
                { label: '위험', color: 'bg-rose-500' },
                { label: '높음', color: 'bg-orange-500' },
                { label: '중간', color: 'bg-amber-500' },
                { label: '낮음', color: 'bg-emerald-500' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center space-x-1.5">
                  <div className={`w-3 h-3 rounded-full ${color}`}></div>
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} font-semibold`}>{label}</span>
                </div>
              ))}
            </div>
          </div> */}

      {/* {analytics.severityTrend.length > 0 ? (
            <div>
              <div className="relative bg-gradient-to-br from-slate-50/30 to-white rounded-xl p-6 border border-gray-100">
                {(() => {
                  const chartData = analytics.severityTrend;
                  const maxValue = Math.max(1, analytics.severityMax);
                  const chartHeight = 300;
                  const baseWidth = 720;
                  const chartWidth = Math.max(baseWidth, 160 + chartData.length * 70);
                  const padding = { top: 20, right: 40, bottom: 40, left: 50 };
                  const graphHeight = chartHeight - padding.top - padding.bottom;
                  const graphWidth = chartWidth - padding.left - padding.right;
                  const pointSpacing = chartData.length > 1 ? graphWidth / (chartData.length - 1) : 0;

                  const generatePath = (dataKey) => {
                    const rawPoints = chartData.map((d, i) => {
                      const x =
                        chartData.length > 1 ? padding.left + i * pointSpacing : padding.left + graphWidth / 2;
                      const clamped = Math.max(0, Math.min(d[dataKey], maxValue));
                      const y = padding.top + graphHeight - (clamped / maxValue) * graphHeight;
                      return {
                        x,
                        y,
                        value: d[dataKey],
                        label: d.label,
                        display: d.display,
                      };
                    });

                    if (rawPoints.length === 0) {
                      return { path: '', points: [] };
                    }

                    if (rawPoints.length === 1) {
                      const single = rawPoints[0];
                      const flatPath = `M ${padding.left} ${single.y} L ${chartWidth - padding.right} ${single.y}`;
                      return { path: flatPath, points: rawPoints };
                    }

                    let path = `M ${rawPoints[0].x} ${rawPoints[0].y}`;
                    for (let i = 0; i < rawPoints.length - 1; i++) {
                      const current = rawPoints[i];
                      const next = rawPoints[i + 1];
                      const cpX = (current.x + next.x) / 2;
                      path += ` Q ${current.x} ${current.y}, ${cpX} ${(current.y + next.y) / 2}`;
                      path += ` T ${next.x} ${next.y}`;
                    }

                    return { path, points: rawPoints };
                  };

                  const criticalData = generatePath('critical');
                  const highData = generatePath('high');
                  const mediumData = generatePath('medium');
                  const lowData = generatePath('low');
                  const axisPoints = lowData.points.length ? lowData.points : criticalData.points;

                  return (
                    <svg width={chartWidth} height={chartHeight} className="w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                      <defs>
                        <linearGradient id="area-critical-main" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="area-high-main" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="area-medium-main" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="area-low-main" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {[0, 1, 2, 3, 4].map((i) => {
                        const y = padding.top + (graphHeight / 4) * i;
                        const value = Math.round(maxValue - (maxValue / 4) * i);
                        return (
                          <g key={i}>
                            <line
                              x1={padding.left}
                              y1={y}
                              x2={chartWidth - padding.right}
                              y2={y}
                              stroke="#e5e7eb"
                              strokeWidth="1"
                              strokeDasharray="4,4"
                            />
                            <text
                              x={padding.left - 10}
                              y={y + 4}
                              textAnchor="end"
                              fontSize="12"
                              fill="#9ca3af"
                              fontWeight="700"
                            >
                              {value}
                            </text>
                          </g>
                        );
                      })}

                      <path
                        d={`${lowData.path} L ${chartWidth - padding.right} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`}
                        fill="url(#area-low-main)"
                      />
                      <path
                        d={`${mediumData.path} L ${chartWidth - padding.right} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`}
                        fill="url(#area-medium-main)"
                      />
                      <path
                        d={`${highData.path} L ${chartWidth - padding.right} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`}
                        fill="url(#area-high-main)"
                      />
                      <path
                        d={`${criticalData.path} L ${chartWidth - padding.right} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`}
                        fill="url(#area-critical-main)"
                      />

                      <path d={lowData.path} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={mediumData.path} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={highData.path} fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={criticalData.path} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                      {[
                        { data: criticalData, color: '#ef4444' },
                        { data: highData, color: '#f97316' },
                        { data: mediumData, color: '#f59e0b' },
                        { data: lowData, color: '#10b981' },
                      ].map((series, sIdx) => (
                        <g key={sIdx}>
                          {series.data.points.map((point, i) => (
                            <g key={i} className="group/dot">
                              <circle cx={point.x} cy={point.y} r="7" fill={series.color} opacity="0.15" className="group-hover/dot:opacity-30 transition-opacity" />
                              <circle cx={point.x} cy={point.y} r="4" fill="white" stroke={series.color} strokeWidth="2.5" className="cursor-pointer transition-all" />
                              <text
                                x={point.x}
                                y={point.y - 18}
                                textAnchor="middle"
                                fontSize="16"
                                fontWeight="700"
                                fill={series.color}
                                className="opacity-0 group-hover/dot:opacity-100 transition-opacity"
                              >
                                {point.value}
                              </text>
                            </g>
                          ))}
                        </g>
                      ))}

                      {(axisPoints.length ? axisPoints : chartData.map((_, i) => ({
                        x: chartData.length > 1 ? padding.left + i * pointSpacing : padding.left + graphWidth / 2,
                        display: chartData[i]?.display || chartData[i]?.label || '',
                      }))).map((point, i) => {
                        const x = point.x ?? (chartData.length > 1 ? padding.left + i * pointSpacing : padding.left + graphWidth / 2);
                        const axisLabel = chartData[i]?.display || point.display || chartData[i]?.label || '';
                        return (
                          <text
                            key={i}
                            x={x}
                            y={chartHeight - padding.bottom + 20}
                            textAnchor="middle"
                            fontSize="14"
                            fill="#6b7280"
                            fontWeight="700"
                          >
                            {axisLabel}
                          </text>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className={`h-64 ${isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-300'} rounded-xl border flex flex-col items-center justify-center`}>
              <svg className={`w-16 h-16 ${isDark ? 'text-gray-600' : 'text-gray-300'} mb-3`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>아직 발견된 취약점이 없습니다</p>
              <p className={`text-xs ${mutedText(isDark)} mt-1`}>스캔을 실행하여 보안 이슈를 확인하세요</p>
            </div>
          )}
        </div> */}

      {/* <div className={`xl:col-span-2 ${cardClass(isDark, 'p-6 hover:shadow-lg transition-shadow border-gray-300', 'p-6 hover:border-gray-600 hover:shadow-cyan-500/10')}`}>
          <div className="mb-6 h-12 flex flex-col justify-center">
            <h3 className={sectionHeadingClass}>스캔 활동 추이</h3>
            <p className={sectionSubtextClass}>최근 10회 스캔 결과</p>
          </div>

          {analytics.activityTrend.length > 0 ? (
            <div>
              <div className={`relative rounded-2xl p-6 border ${isDark ? 'bg-gray-900/40 border-gray-700' : 'bg-gradient-to-br from-slate-50/30 to-white border-gray-100'}`}>
                {(() => {
                  const scanData = analytics.activityTrend;
                  const maxValue = Math.max(1, analytics.activityMax);
                  const chartHeight = 220;
                  const baseWidth = 460;
                  const chartWidth = Math.max(baseWidth, 140 + scanData.length * 60);
                  const padding = { top: 15, right: 30, bottom: 35, left: 45 };
                  const graphHeight = chartHeight - padding.top - padding.bottom;
                  const graphWidth = chartWidth - padding.left - padding.right;
                  const pointSpacing = scanData.length > 1 ? graphWidth / (scanData.length - 1) : 0;

                  const points = scanData.map((d, i) => {
                    const x = scanData.length > 1 ? padding.left + i * pointSpacing : padding.left + graphWidth / 2;
                    const y = padding.top + graphHeight - (Math.max(0, d.total) / maxValue) * graphHeight;
                    return {
                      x,
                      y,
                      value: d.total,
                      label: d.label,
                      display: d.display || `#${d.id}`,
                    };
                  });

                  let path = '';
                  if (points.length === 1) {
                    const single = points[0];
                    path = `M ${padding.left} ${single.y} L ${chartWidth - padding.right} ${single.y}`;
                  } else {
                    path = `M ${points[0].x} ${points[0].y}`;
                    for (let i = 0; i < points.length - 1; i++) {
                      const current = points[i];
                      const next = points[i + 1];
                      const cpX = (current.x + next.x) / 2;
                      path += ` Q ${current.x} ${current.y}, ${cpX} ${(current.y + next.y) / 2}`;
                      path += ` T ${next.x} ${next.y}`;
                    }
                  }

                  return (
                    <svg width={chartWidth} height={chartHeight} className="w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                      <defs>
                        <linearGradient id="area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {[0, 1, 2, 3].map((i) => {
                        const y = padding.top + (graphHeight / 3) * i;
                        const value = Math.round(maxValue - (maxValue / 3) * i);
                        return (
                          <g key={i}>
                            <line
                              x1={padding.left}
                              y1={y}
                              x2={chartWidth - padding.right}
                              y2={y}
                              stroke="#e5e7eb"
                              strokeWidth="1"
                              strokeDasharray="3,3"
                            />
                            <text
                              x={padding.left - 8}
                              y={y + 4}
                              textAnchor="end"
                              fontSize="14"
                              fill="#9ca3af"
                              fontWeight="700"
                            >
                              {value}
                            </text>
                          </g>
                        );
                      })}

                      <path d={`${path} L ${chartWidth - padding.right} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`} fill="url(#area-gradient)" />
                      <path d={path} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                      {points.map((point, i) => (
                        <g key={i} className="group/dot cursor-pointer">
                          <circle cx={point.x} cy={point.y} r="8" fill="#6366f1" opacity="0.15" className="group-hover/dot:opacity-30 transition-opacity" />
                          <circle cx={point.x} cy={point.y} r="5" fill="white" stroke="#6366f1" strokeWidth="3" className="group-hover/dot:r-6 transition-all" />
                          <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity">
                            <rect x={point.x - 20} y={point.y - 35} width="40" height="24" rx="6" fill="#1e293b" />
                            <text x={point.x} y={point.y - 23} textAnchor="middle" fontSize="10" fill="white" fontWeight="700">
                              {point.value}
                            </text>
                          </g>
                          <text x={point.x} y={point.y - 22} textAnchor="middle" fontSize="16" fill="#6366f1" fontWeight="800">
                            {point.value}
                          </text>
                        </g>
                      ))} */}

      {/* {scanData.map((d, i) => {
                        if (scanData.length > 1 && i % 2 !== 0) return null;
                        const x = scanData.length > 1 ? padding.left + i * pointSpacing : padding.left + graphWidth / 2;
                        const axisLabel = d.display || d.label || `#${d.id}`;
                        return (
                          <text
                            key={i}
                            x={x}
                            y={chartHeight - padding.bottom + 20}
                            textAnchor="middle"
                            fontSize="14"
                            fill="#4b5563"
                            fontWeight="700"
                          >
                            {axisLabel}
                          </text>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-2.5 mt-4">
                {trendSummaryCards.map((card) => {
                  const palette = {
                    light: {
                      indigo: { container: 'bg-indigo-50 border-indigo-300', label: 'text-indigo-600', value: 'text-indigo-600' },
                      emerald: { container: 'bg-emerald-50 border-emerald-300', label: 'text-emerald-600', value: 'text-emerald-600' },
                    },
                    dark: {
                      indigo: { container: 'bg-indigo-500/15 border-indigo-400/40', label: 'text-indigo-200', value: 'text-indigo-100' },
                      emerald: { container: 'bg-emerald-500/15 border-emerald-400/40', label: 'text-emerald-200', value: 'text-emerald-100' },
                    },
                  };

                  const tone = isDark ? palette.dark : palette.light;
                  const accent = tone[card.accent] || tone.indigo;

                  return (
                    <div key={card.id} className={`rounded-lg p-2.5 border ${accent.container}`}>
                      <div className={`text-[10px] font-semibold mb-0.5 ${accent.label}`}>{card.label}</div>
                      <div className={`text-xl font-black ${accent.value}`}>{card.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={`h-64 ${isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-300'} rounded-xl border flex flex-col items-center justify-center`}>
              <svg className={`w-16 h-16 ${isDark ? 'text-gray-600' : 'text-gray-300'} mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className={`text-sm ${mutedText(isDark)}`}>데이터가 없습니다</p>
            </div>
          )}
        </div>
      </div> */}

      {/* <div className={cardClass(isDark, 'p-6 hover:shadow-lg transition-shadow mb-6 mt-6 border-gray-300', 'p-6 hover:border-gray-600 hover:shadow-cyan-500/10 mb-6 mt-6')}>
        <div className="mb-4">
          <h3 className={sectionHeadingClass}>취약점 타입별 분포</h3>
          <p className={`text-xs ${mutedText(isDark)} mt-1`}>발견된 취약점 유형 현황</p>
        </div>

        {analytics.vulnerabilityTypes.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {analytics.vulnerabilityTypes.map((item, index) => {
              const severityKey = dominantSeverity(item.severityCounts);
              const palette = severityPalette[severityKey] || severityPalette.default;
              const tone = isDark ? palette.dark : palette.light;
              const maxCount = analytics.typeMax || 1;
              const percentage = Math.round((item.count / maxCount) * 100);
              const severityChips = severityOrder.filter((level) => item.severityCounts[level] > 0);

              return (
                <div
                  key={`${item.title}-${index}`}
                  className={`${cardClass(
                    isDark,
                    'p-4 transition-all hover:shadow-md group',
                    'p-4 transition-all hover:shadow-cyan-500/10 group'
                  )} border ${tone.border} ${isDark ? 'hover:border-gray-600' : 'hover:border-gray-300'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 ${tone.bg} border ${tone.border} rounded-lg flex items-center justify-center`}>
                      <span className={`text-sm font-semibold ${tone.text}`}>{index + 1}</span>
                    </div>
                    <div className={`text-3xl font-bold ${tone.text}`}>{item.count}</div>
                  </div>
                  <div className={`text-sm font-semibold ${mutedText(isDark, 'text-gray-700', 'text-gray-200')} truncate`}>{item.title}</div>
                  {severityChips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {severityChips.map((severity) => {
                        const chipTone = severityPalette[severity] || severityPalette.default;
                        const chip = isDark ? chipTone.dark : chipTone.light;
                        return (
                          <span key={severity} className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${chip.chip || ''}`}>
                            {severity.toUpperCase()} {item.severityCounts[severity]}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className={`mt-4 h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                    <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`h-48 ${isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-300'} rounded-xl border flex flex-col items-center justify-center`}>
            <svg className={`w-12 h-12 ${isDark ? 'text-gray-600' : 'text-gray-300'} mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className={`text-sm ${mutedText(isDark)}`}>데이터가 없습니다</p>
          </div>
        )}
      </div> */}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className={cardClass(isDark, 'p-6 hover:shadow-lg transition-shadow border border-gray-300', 'p-6 hover:border-gray-500 hover:shadow-cyan-500/10 border border-gray-700/80')}>
          <div className="mb-4">
            <h3 className={sectionHeadingClass}>상위 CWE 분포</h3>
            <p className={`text-xs ${mutedText(isDark)} mt-1`}>가장 많이 발견된 취약점 유형</p>
          </div>

          {analytics.topCwe.length > 0 ? (
            <div className="space-y-3">
              {analytics.topCwe.map((item, idx) => {
                const dominant = dominantSeverity(item.severityCounts);
                const palette = severityPalette[dominant] || severityPalette.default;
                const tone = isDark ? palette.dark : palette.light;
                const maxCount = analytics.topCweMax || 1;
                const percentage = Math.round((item.count / maxCount) * 100);

                const summary = severityOrder
                  .filter((level) => item.severityCounts[level] > 0)
                  .map((level) => `${level.toUpperCase()} ${item.severityCounts[level]}`)
                  .join(' · ');

                return (
                  <div key={idx} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span className={`text-sm font-mono font-bold ${tone.text}`}>{item.cwe}</span>
                        <span className={`text-sm ${mutedText(isDark, 'text-gray-600', 'text-gray-300')} truncate`}>
                          {item.sampleTitle || '알 수 없는 이슈'}
                        </span>
                      </div>
                      <span className={`text-base font-black ${tone.text} ml-2`}>{item.count}</span>
                    </div>
                    {summary && <div className="text-[11px] text-gray-400 mb-1">{summary}</div>}
                    <div className={`relative h-2.5 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                      <div
                        className={`h-full ${tone.bar} transition-all duration-700 ease-out`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      >
                        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-r from-transparent via-white/10 to-transparent' : 'bg-gradient-to-r from-transparent via-white/30 to-transparent'} animate-shimmer`}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`h-48 ${isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-300'} rounded-xl border flex flex-col items-center justify-center`}>
              <svg className={`w-12 h-12 ${isDark ? 'text-gray-600' : 'text-gray-300'} mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className={`text-sm ${mutedText(isDark)}`}>데이터가 없습니다</p>
            </div>
          )}
        </div>

        <div className={cardClass(isDark, 'p-6 hover:shadow-lg transition-shadow border border-gray-300', 'p-6 hover:border-gray-600 hover:shadow-cyan-500/10 border border-gray-700/80')}>
          <div className="mb-4">
            <h3 className={sectionHeadingClass}>취약점이 많은 파일</h3>
            <p className={`text-xs ${mutedText(isDark)} mt-1`}>가장 많은 이슈가 발견된 파일</p>
          </div>

          {analytics.topFiles.length > 0 ? (
            <div className="space-y-3">
              {analytics.topFiles.map((item) => (
                <div
                  key={item.file}
                  className={softCardClass(
                    isDark,
                    'p-3 hover:shadow-md transition-all cursor-pointer border border-gray-300',
                    'p-3 hover:border-gray-600 hover:shadow-cyan-500/10 cursor-pointer border border-gray-700 bg-gray-900/30'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <svg className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className={`text-xs font-mono ${isDark ? 'text-gray-100 group-hover:text-cyan-300' : 'text-gray-900 group-hover:text-indigo-600'} truncate transition-colors`}>{item.file}</span>
                    </div>
                    <span className={`text-sm font-black ${isDark ? 'text-gray-200' : 'text-gray-900'} ml-2`}>{item.count}</span>
                  </div>
                  <div className="flex items-center space-x-2 ml-6">
                    {item.severityCounts.critical > 0 && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${isDark ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40' : 'bg-rose-50 text-rose-600 border border-rose-300'}`}>
                        위험 {item.severityCounts.critical}
                      </span>
                    )}
                    {item.severityCounts.high > 0 && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${isDark ? 'bg-orange-500/20 text-orange-300 border border-orange-400/40' : 'bg-orange-50 text-orange-600 border border-orange-300'}`}>
                        높음 {item.severityCounts.high}
                      </span>
                    )}
                    {item.severityCounts.medium > 0 && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'bg-amber-50 text-amber-600 border border-amber-300'}`}>
                        중간 {item.severityCounts.medium}
                      </span>
                    )}
                    {item.severityCounts.low > 0 && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-emerald-50 text-emerald-600 border border-emerald-300'}`}>
                        낮음 {item.severityCounts.low}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`h-48 ${isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-300'} rounded-xl border flex flex-col items-center justify-center`}>
              <svg className={`w-12 h-12 ${isDark ? 'text-gray-600' : 'text-gray-300'} mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className={`text-sm ${mutedText(isDark)}`}>데이터가 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ProjectAnalyticsGrid;
