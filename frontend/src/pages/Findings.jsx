import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';
import projectService from '../services/projectService';
import scanService from '../services/scanService';
import ProjectNavbar from '../components/common/ProjectNavbar';
import { useTheme } from '../hooks/useTheme';
import { cardClass, mutedText } from '../utils/themeStyles';

function Findings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [project, setProject] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [filterSeverity, setFilterSeverity] = useState('all'); // all, critical, high, medium, low
  const [filterStatus, setFilterStatus] = useState('all'); // all, open, resolved
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const severityLabelMap = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  const statusLabelMap = {
    open: '미해결',
    in_progress: '조치 중',
    resolved: '해결됨',
    false_positive: '오탐',
  };

  const severitySortRank = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const openStatuses = ['open', 'in_progress'];
  const resolvedStatuses = ['resolved', 'false_positive'];

  const normalizeSeverity = (value) => {
    const key = (value || '').toLowerCase();
    if (severityLabelMap[key]) {
      return { label: severityLabelMap[key], key };
    }
    if (key === 'info') {
      return { label: 'Info', key: 'low' };
    }
    return { label: 'Medium', key: 'medium' };
  };

  const normalizeStatus = (value) => {
    const key = (value || 'open').toLowerCase();
    if (statusLabelMap[key]) {
      return key;
    }
    return 'open';
  };

  const extractCodeSnippet = (vuln) => {
    const taint = vuln?.taint_flow_analysis;
    if (taint) {
      if (taint.sink?.code) return taint.sink.code;
      if (taint.propagation?.code) return taint.propagation.code;
      if (taint.source?.code) return taint.source.code;
    }
    if (vuln?.recommendation?.code_example_fix) return vuln.recommendation.code_example_fix;
    if (vuln?.proof_of_concept?.example) return vuln.proof_of_concept.example;
    return null;
  };

  const buildFindingFromVulnerability = (vuln, scan, index) => {
    const { label: severityLabel, key: severityKey } = normalizeSeverity(vuln?.severity);
    const statusKey = normalizeStatus(vuln?.status);
    const statusLabel = statusLabelMap[statusKey] || statusLabelMap.open;

    return {
      id: vuln?.id ? `scan-${scan.id}-vuln-${vuln.id}` : `scan-${scan.id}-vuln-${index}`,
      vulnerability_id: vuln?.id,
      scan_id: scan.id,
      scan_type: scan.scan_type || scan?.scan_config?.scan_type || 'N/A',
      scan_date: scan.completed_at || scan.created_at,
      title: vuln?.title || vuln?.cwe || '미정',
      severity: severityLabel,
      severity_key: severityKey,
      cwe: vuln?.cwe || 'N/A',
      file_path: vuln?.file_path || 'N/A',
      line_number: vuln?.line_number || 'N/A',
      status: statusKey,
      status_label: statusLabel,
      description: vuln?.description || vuln?.recommendation?.how_to_fix || '설명이 제공되지 않았습니다.',
      code_snippet: extractCodeSnippet(vuln),
      taint_flow: vuln?.taint_flow_analysis || null,
      recommendation: vuln?.recommendation || null,
      proof_of_concept: vuln?.proof_of_concept || null,
    };
  };

  const fetchVulnerabilitiesForScans = async (scanList = []) => {
    const completedScans = scanList.filter((scan) => scan.status === 'completed');
    if (!completedScans.length) {
      return [];
    }

    const results = await Promise.all(
      completedScans.map(async (scan) => {
        try {
          const response = await scanService.getScanVulnerabilities(id, scan.id);
          return (response || []).map((item, index) => buildFindingFromVulnerability(item, scan, index));
        } catch (err) {
          console.error(`Failed to load vulnerabilities for scan ${scan.id}`, err);
          setError('일부 취약점 데이터를 불러오지 못했습니다.');
          return [];
        }
      })
    );

    return results.flat();
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  useEffect(() => {
    const init = async () => {
      const isAuth = await authService.isAuthenticated();
      if (!isAuth) {
        navigate('/login');
        return;
      }
      
      // Load user data
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      try {
        setLoading(true);
        setError('');

        try {
          const projectData = await projectService.getProject(id);
          if (projectData) {
            setProject(projectData);
            setProjectName(projectData.name);
          }
        } catch (projectError) {
          console.error('Failed to load project metadata:', projectError);
        }

        const scanData = await scanService.getScans(id);
        const normalizedScans = scanData || [];

        if (!projectName && normalizedScans.length > 0) {
          const firstScan = normalizedScans[0];
          const projectLabel = firstScan?.project?.name || firstScan?.project_name;
          if (projectLabel) {
            setProjectName(projectLabel);
          }
        }

        const vulnList = await fetchVulnerabilitiesForScans(normalizedScans);
        setVulnerabilities(vulnList);
      } catch (e) {
        setError(typeof e === 'string' ? e : (e?.response?.data?.detail || 'Failed to load findings'));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, navigate]);

  // 스캔에서 수집된 취약점 목록 (정규화된 vulnerability 테이블 기반)
  const findings = useMemo(() => {
    return [...vulnerabilities].sort((a, b) => {
      const rankA = severitySortRank[a.severity_key] ?? 99;
      const rankB = severitySortRank[b.severity_key] ?? 99;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const dateA = a.scan_date ? new Date(a.scan_date).getTime() : 0;
      const dateB = b.scan_date ? new Date(b.scan_date).getTime() : 0;
      return dateB - dateA;
            });
  }, [vulnerabilities]);

  // 필터링된 취약점 (useMemo로 최적화)
  const filteredFindings = useMemo(() => {
    return findings.filter(finding => {
      // Severity 필터
      if (filterSeverity !== 'all' && finding.severity_key !== filterSeverity) {
        return false;
      }
      
      // Status 필터
      if (filterStatus === 'open' && !openStatuses.includes(finding.status)) {
        return false;
      }
      if (filterStatus === 'resolved' && !resolvedStatuses.includes(finding.status)) {
        return false;
      }
      
      // 검색 쿼리
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          finding.title.toLowerCase().includes(query) ||
          finding.file_path.toLowerCase().includes(query) ||
          finding.cwe.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [findings, filterSeverity, filterStatus, searchQuery]);

  // Severity 통계 (useMemo로 최적화)
  const severityStats = useMemo(() => ({
    critical: findings.filter(f => f.severity_key === 'critical').length,
    high: findings.filter(f => f.severity_key === 'high').length,
    medium: findings.filter(f => f.severity_key === 'medium').length,
    low: findings.filter(f => f.severity_key === 'low').length,
  }), [findings]);

  const { critical, high, medium, low } = severityStats;

  const statCards = useMemo(() => ([
    {
      id: 'total',
      label: '전체',
      value: findings.length,
      description: '전체 취약점',
      accent: 'indigo',
      iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0117 9v10a2 2 0 01-2 2z'
    },
    {
      id: 'critical',
      label: '위험 + 높음',
      value: critical + high,
      description: '즉시 조치 필요',
      accent: 'rose',
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L4.34 16c-.77 1.333.192 3 1.732 3z'
    },
    {
      id: 'medium',
      label: '중간',
      value: medium,
      description: '검토 필요',
      accent: 'amber',
      iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      id: 'low',
      label: '낮음',
      value: low,
      description: '낮은 우선순위',
      accent: 'emerald',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  ]), [findings.length, critical, high, medium, low]);

  const getSeverityColor = (severity) => {
    const colors = {
      Critical: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', badge: 'bg-rose-500 text-white', label: '위험' },
      High: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', badge: 'bg-orange-500 text-white', label: '높음' },
      Medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', badge: 'bg-amber-500 text-white', label: '중간' },
      Low: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', badge: 'bg-yellow-500 text-white', label: '낮음' }
    };
    return colors[severity] || colors.Medium;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openDetailModal = (finding) => {
    setSelectedFinding(finding);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800' : 'bg-[#EAF2FF]'}`}>
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-cyan-300' : 'border-indigo-600'}`}></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800' : 'bg-[#EAF2FF]'}`}>
      {isDark ? (
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-600 opacity-10 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-cyan-600 opacity-10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-purple-600 opacity-10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      ) : (
        <div className="fixed inset-0 -z-10 bg-[#EAF2FF]" />
      )}

      <ProjectNavbar
        projectId={id}
        projectName={projectName || '프로젝트'}
        user={user}
        handleLogout={handleLogout}
        triggerMode={project?.trigger_mode}
      />

      {/* Main Content */}
      <main className="pt-36 px-8 pb-10">
        <div className="max-w-[1400px] mx-auto">

        {/* Hero Header */}
        <div className={`relative overflow-hidden mb-8 rounded-3xl border ${isDark ? 'border-gray-700/60 bg-gray-800/80' : 'border-white/60 bg-white/80'} backdrop-blur-xl p-8`}>
          <div className={`absolute -top-12 -right-12 w-64 h-64 ${isDark ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10' : 'bg-gradient-to-br from-indigo-500/15 to-purple-500/15'} rounded-full blur-3xl`}></div>
          <div className="relative">
            <h1 className={`text-4xl font-extrabold tracking-tight ${isDark ? 'bg-gradient-to-r from-gray-100 via-cyan-200 to-blue-200' : 'bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900'} bg-clip-text text-transparent`}>
              취약점 관리
            </h1>
            <p className={`mt-3 text-base ${isDark ? 'text-gray-400' : 'text-gray-600'} max-w-2xl`}>
              발견된 취약점을 한눈에 모아 분석하고 조치 상태를 추적합니다.
            </p>
          </div>
        </div>

        {error && (
          <div
            className={`mb-6 px-4 py-3 rounded-xl border-2 text-sm font-medium ${
              isDark ? 'border-rose-500/40 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {error}
          </div>
        )}

        {/* Stats Cards - Unified Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
          {statCards.map((card) => {
            const accentStyles = {
              indigo: {
                light: {
                  card: 'bg-white border-indigo-200 hover:border-indigo-300',
                  iconBg: 'bg-indigo-50 border-indigo-100',
                  iconColor: 'text-indigo-600',
                  description: 'text-indigo-600'
                },
                dark: {
                  card: 'bg-gray-800/60 border-indigo-500/30 hover:border-indigo-400/40',
                  iconBg: 'bg-indigo-500/15 border-indigo-400/40',
                  iconColor: 'text-indigo-200',
                  description: 'text-indigo-300'
                }
              },
              rose: {
                light: {
                  card: 'bg-white border-rose-200 hover:border-rose-300',
                  iconBg: 'bg-rose-50 border-rose-100',
                  iconColor: 'text-rose-600',
                  description: 'text-rose-600'
                },
                dark: {
                  card: 'bg-gray-800/60 border-rose-500/30 hover:border-rose-400/40',
                  iconBg: 'bg-rose-500/15 border-rose-400/40',
                  iconColor: 'text-rose-200',
                  description: 'text-rose-300'
                }
              },
              amber: {
                light: {
                  card: 'bg-white border-amber-200 hover:border-amber-300',
                  iconBg: 'bg-amber-50 border-amber-100',
                  iconColor: 'text-amber-600',
                  description: 'text-amber-600'
                },
                dark: {
                  card: 'bg-gray-800/60 border-amber-500/30 hover:border-amber-400/40',
                  iconBg: 'bg-amber-500/15 border-amber-400/40',
                  iconColor: 'text-amber-200',
                  description: 'text-amber-300'
                }
              },
              emerald: {
                light: {
                  card: 'bg-white border-emerald-200 hover:border-emerald-300',
                  iconBg: 'bg-emerald-50 border-emerald-100',
                  iconColor: 'text-emerald-600',
                  description: 'text-emerald-600'
                },
                dark: {
                  card: 'bg-gray-800/60 border-emerald-500/30 hover:border-emerald-400/40',
                  iconBg: 'bg-emerald-500/15 border-emerald-400/40',
                  iconColor: 'text-emerald-200',
                  description: 'text-emerald-300'
                }
              }
            };

            const palette = accentStyles[card.accent];
            const cardClasses = isDark ? palette.dark.card : palette.light.card;
            const iconWrapper = isDark ? palette.dark.iconBg : palette.light.iconBg;
            const iconColor = isDark ? palette.dark.iconColor : palette.light.iconColor;
            const descriptionColor = isDark ? palette.dark.description : palette.light.description;

            return (
              <div
                key={card.id}
                className={`rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${cardClasses}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className={`text-xs uppercase tracking-wider font-semibold ${mutedText(isDark, 'text-gray-600', 'text-gray-300')}`}>{card.label}</p>
                    <p className={`mt-3 text-4xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{card.value}</p>
                    <p className={`mt-2 text-xs font-medium ${descriptionColor}`}>{card.description}</p>
        </div>
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-sm ${iconWrapper}`}>
                    <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.iconPath} />
                </svg>
              </div>
            </div>
          </div>
            );
          })}
        </div>

        {/* Filters & Search */}
        <div className={`${cardClass(isDark, 'p-5 shadow-sm mb-6 transition-all', 'p-5 shadow-sm mb-6 transition-all')} ${isDark ? 'bg-gray-900/40' : 'bg-white/95'}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="w-full md:max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="취약점 제목, 파일명, CWE 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${isDark ? 'bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500' : 'bg-white border border-gray-300 text-gray-800 placeholder-gray-400'}`}
                />
                <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <svg className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <label className={`text-sm font-semibold ${mutedText(isDark, 'text-gray-700', 'text-gray-200')}`}>심각도</label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${isDark ? 'bg-gray-900 border border-gray-700 text-gray-100 hover:border-gray-600' : 'bg-white border border-gray-300 text-gray-800 hover:border-gray-400'}`}
              >
                <option value="all">모든 심각도</option>
                  <option value="critical">위험</option>
                  <option value="high">높음</option>
                  <option value="medium">중간</option>
                  <option value="low">낮음</option>
              </select>
              </div>

              <div className="flex items-center gap-2">
                <svg className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <label className={`text-sm font-semibold ${mutedText(isDark, 'text-gray-700', 'text-gray-200')}`}>상태</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${isDark ? 'bg-gray-900 border border-gray-700 text-gray-100 hover:border-gray-600' : 'bg-white border border-gray-300 text-gray-800 hover:border-gray-400'}`}
              >
                <option value="all">모든 상태</option>
                  <option value="open">미해결</option>
                  <option value="resolved">해결됨</option>
              </select>
              </div>
            </div>
          </div>
        </div>

        {/* Findings Table */}
        <div className={`rounded-xl border shadow-sm overflow-hidden ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`px-5 py-3 flex items-center justify-between ${isDark ? 'bg-gray-900/40 border-b border-gray-700' : 'bg-gray-50 border-b border-gray-200'}`}>
            <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>취약점 목록</h3>
            <span className={`text-xs font-medium ${mutedText(isDark, 'text-gray-500', 'text-gray-400')}`}>{filteredFindings.length}건</span>
          </div>
          {filteredFindings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={isDark ? 'bg-gray-900/40 border-b border-gray-700' : 'bg-gray-50 border-b border-gray-200'}>
                  <tr>
                    <th className={`px-6 py-3 text-left font-semibold ${mutedText(isDark, 'text-gray-600', 'text-gray-300')} uppercase text-[11px] tracking-wider`}>취약점</th>
                    <th className={`px-6 py-3 text-left font-semibold ${mutedText(isDark, 'text-gray-600', 'text-gray-300')} uppercase text-[11px] tracking-wider`}>위험도</th>
                    <th className={`px-6 py-3 text-left font-semibold ${mutedText(isDark, 'text-gray-600', 'text-gray-300')} uppercase text-[11px] tracking-wider`}>상태</th>
                    <th className={`px-6 py-3 text-left font-semibold ${mutedText(isDark, 'text-gray-600', 'text-gray-300')} uppercase text-[11px] tracking-wider`}>파일</th>
                    <th className={`px-6 py-3 text-right font-semibold ${mutedText(isDark, 'text-gray-600', 'text-gray-300')} uppercase text-[11px] tracking-wider`}>발견·업데이트</th>
                  </tr>
                </thead>
                <tbody className={isDark ? 'divide-y divide-gray-800/80' : 'divide-y divide-gray-100'}>
                  {filteredFindings.map((finding) => {
                    const colors = getSeverityColor(finding.severity);
                    const isResolvedStatus = resolvedStatuses.includes(finding.status);
                    const statusBadge = isResolvedStatus
                      ? `bg-emerald-500/15 text-emerald-300 border border-emerald-400/40`
                      : `bg-rose-500/15 text-rose-300 border border-rose-400/40`;
                    const statusBadgeLight = isResolvedStatus
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-red-100 text-red-700 border border-red-200';

                    return (
                      <tr
                        key={finding.id}
                        className={isDark ? 'hover:bg-gray-800/40 transition-colors' : 'hover:bg-gray-50 transition-colors'}
                      >
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'} line-clamp-1`}>{finding.title}</div>
                          <div className={`text-xs mt-0.5 line-clamp-1 ${mutedText(isDark)}`}>{finding.description}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${colors.badge}`}>{colors.label || finding.severity}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${isDark ? statusBadge : statusBadgeLight}`}>
                            {finding.status_label || (isResolvedStatus ? '해결됨' : '미해결')}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className={`text-[10px] font-mono truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{finding.file_path}</div>
                          <div className={`text-[10px] mt-0.5 ${mutedText(isDark)}`}>L{finding.line_number}</div>
                        </td>
                        <td className={`px-3 py-3 whitespace-nowrap text-[10px] ${mutedText(isDark, 'text-gray-600', 'text-gray-400')}`}>
                          {formatDate(finding.scan_date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className={`mt-4 text-sm ${mutedText(isDark)}`}>필터 조건에 맞는 취약점이 없습니다</p>
            </div>
          )}
        </div>

        {/* Results Count */}
        {filteredFindings.length > 0 && (
          <div className={`mt-4 text-sm text-center ${mutedText(isDark)}`}>
            총 <span className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{filteredFindings.length}</span>개의 취약점
          </div>
        )}
        </div>
      </main>

      {/* Detail Modal */}
      {showDetailModal && selectedFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={() => setShowDetailModal(false)}>
          <div
            className={`${isDark ? 'bg-gray-900 text-gray-100 border border-gray-700/60' : 'bg-white text-gray-900 border border-white/60'} rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`sticky top-0 backdrop-blur-xl p-5 flex items-center justify-between ${isDark ? 'bg-gray-900/90 border-b border-gray-700' : 'bg-white/90 border-b border-gray-200'}`}>
              <div>
                <h3 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{selectedFinding.title}</h3>
                <div className="flex items-center space-x-2 mt-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getSeverityColor(selectedFinding.severity).badge}`}>
                    {selectedFinding.severity}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${isDark ? 'bg-gray-800 border border-gray-600 text-gray-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>{selectedFinding.cwe}</span>
                  <span className={`text-xs ${mutedText(isDark)}`}>스캔 유형: {selectedFinding.scan_type}</span>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
                <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
              <div className="space-y-5">
                {/* Location */}
                <div className={`${isDark ? 'bg-gray-800/40 border border-gray-700' : 'bg-gray-50 border border-gray-200'} rounded-xl p-4`}>
                  <h4 className={`text-sm font-bold mb-2 flex items-center ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    위치
                  </h4>
                  <div className={`text-sm ${mutedText(isDark, 'text-gray-700', 'text-gray-300')}`}>
                    <div className={`font-mono p-2 rounded border ${isDark ? 'bg-gray-900/40 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                      📂 {selectedFinding.file_path}
                    </div>
                    <div className={`mt-2 text-xs ${mutedText(isDark)}`}>📍 Line {selectedFinding.line_number}</div>
                  </div>
                </div>

                {/* Description */}
                <div className={`${isDark ? 'bg-gray-900/30 border border-gray-700' : 'bg-white border border-gray-200'} rounded-xl p-4`}>
                  <h4 className={`text-sm font-bold mb-2 flex items-center ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    설명
                  </h4>
                  <p className={`text-sm leading-relaxed ${mutedText(isDark, 'text-gray-700', 'text-gray-200')}`}>{selectedFinding.description}</p>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`${isDark ? 'bg-blue-500/15 border border-blue-400/40 text-blue-200' : 'bg-blue-50 border border-blue-200 text-blue-700'} rounded-xl p-4`}>
                    <div className="text-xs font-bold mb-1">발견 일시</div>
                    <div className={`text-sm font-semibold ${isDark ? 'text-blue-100' : 'text-blue-900'}`}>{formatDate(selectedFinding.scan_date)}</div>
                  </div>
                  <div className={`${isDark ? 'bg-purple-500/15 border border-purple-400/40 text-purple-200' : 'bg-purple-50 border border-purple-200 text-purple-700'} rounded-xl p-4`}>
                    <div className="text-xs font-bold mb-1">상태</div>
                    <div className={`text-sm font-semibold ${isDark ? 'text-purple-100' : 'text-purple-900'}`}>
                      {selectedFinding.status_label || (resolvedStatuses.includes(selectedFinding.status) ? '해결됨' : '미해결')}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className={`flex items-center justify-end space-x-3 pt-4 ${isDark ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}>
                  <button className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${isDark ? 'text-gray-300 hover:text-gray-100 bg-gray-800 hover:bg-gray-700 border-gray-600' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border-gray-200'}`}>
                    내보내기
                  </button>
                  <button className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-indigo-500/20 shadow">
                    Jira 티켓 생성
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Findings;

