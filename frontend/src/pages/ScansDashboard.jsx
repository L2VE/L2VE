import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';
import scanService from '../services/scanService';
import AppNavbar from '../components/common/AppNavbar';
import MetricCard from '../components/dashboard/MetricCard';
import VulnerabilityTrendChart from '../components/dashboard/VulnerabilityTrendChart';
import { useTheme } from '../hooks/useTheme';

function ScansDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark, theme: globalTheme } = useTheme();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeFilter, setTimeFilter] = useState(7);
  const [user, setUser] = useState(null);

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

      // 유저 정보 로드
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      try {
        setLoading(true);
        const list = await scanService.getScans(id);
        setScans(list || []);
      } catch (e) {
        setError(typeof e === 'string' ? e : (e?.response?.data?.detail || '스캔 목록을 불러오지 못했습니다.'));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, navigate]);

  // 시간 필터링
  const filteredScans = scans.filter(scan => {
    if (!scan.created_at) return true;
    const scanDate = new Date(scan.created_at);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeFilter);
    return scanDate >= cutoffDate;
  });

  // 데이터 집계
  const totalScans = filteredScans.length;
  const completedScans = filteredScans.filter(s => s.status === 'completed').length;
  const failedScans = filteredScans.filter(s => s.status === 'failed').length;
  const runningScans = filteredScans.filter(s => s.status === 'running').length;

  // 취약점 통계
  const vulnStats = {
    critical: filteredScans.reduce((sum, s) => sum + (s.critical || 0), 0),
    high: filteredScans.reduce((sum, s) => sum + (s.high || 0), 0),
    medium: filteredScans.reduce((sum, s) => sum + (s.medium || 0), 0),
    low: filteredScans.reduce((sum, s) => sum + (s.low || 0), 0)
  };
  const totalVulnerabilities = vulnStats.critical + vulnStats.high + vulnStats.medium + vulnStats.low;
  const cvssMax = Math.max(vulnStats.critical, vulnStats.high, vulnStats.medium, vulnStats.low, 1);
  const cvssItems = [
    {
      range: '9.0 - 10.0',
      label: 'Critical',
      count: vulnStats.critical,
      palette: {
        light: {
          badge: 'bg-rose-100 text-rose-700 border border-rose-200',
          count: 'text-rose-600',
          bar: 'bg-gradient-to-r from-rose-600 via-rose-500 to-orange-400',
          barText: 'text-white',
          shadow: '0 10px 26px -12px rgba(244, 63, 94, 0.45)',
        },
        dark: {
          badge: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
          count: 'text-rose-200',
          bar: 'bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300',
          barText: 'text-white',
          shadow: '0 14px 32px -14px rgba(248, 113, 113, 0.55)',
        },
      },
    },
    {
      range: '7.0 - 8.9',
      label: 'High',
      count: vulnStats.high,
      palette: {
        light: {
          badge: 'bg-orange-100 text-orange-700 border border-orange-200',
          count: 'text-orange-600',
          bar: 'bg-gradient-to-r from-orange-500 via-amber-400 to-amber-300',
          barText: 'text-white',
          shadow: '0 10px 24px -12px rgba(249, 115, 22, 0.45)',
        },
        dark: {
          badge: 'bg-orange-500/20 text-amber-200 border border-orange-400/40',
          count: 'text-amber-200',
          bar: 'bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200',
          barText: 'text-slate-900',
          shadow: '0 14px 30px -14px rgba(251, 191, 36, 0.45)',
        },
      },
    },
    {
      range: '4.0 - 6.9',
      label: 'Medium',
      count: vulnStats.medium,
      palette: {
        light: {
          badge: 'bg-amber-100 text-amber-700 border border-amber-200',
          count: 'text-amber-600',
          bar: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-yellow-200',
          barText: 'text-slate-900',
          shadow: '0 10px 20px -12px rgba(251, 191, 36, 0.35)',
        },
        dark: {
          badge: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
          count: 'text-amber-200',
          bar: 'bg-gradient-to-r from-amber-300 via-yellow-200 to-lime-200',
          barText: 'text-slate-900',
          shadow: '0 12px 26px -14px rgba(250, 204, 21, 0.35)',
        },
      },
    },
    {
      range: '0.1 - 3.9',
      label: 'Low',
      count: vulnStats.low,
      palette: {
        light: {
          badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
          count: 'text-emerald-600',
          bar: 'bg-gradient-to-r from-emerald-400 via-emerald-300 to-lime-200',
          barText: 'text-slate-900',
          shadow: '0 10px 20px -12px rgba(52, 211, 153, 0.35)',
        },
        dark: {
          badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
          count: 'text-emerald-200',
          bar: 'bg-gradient-to-r from-emerald-300 via-emerald-200 to-lime-200',
          barText: 'text-slate-900',
          shadow: '0 12px 24px -14px rgba(16, 185, 129, 0.35)',
        },
      },
    },
  ];


  // Risk Score 계산
  const riskScore = totalVulnerabilities > 0
    ? Math.min(100, Math.round(
      (vulnStats.critical * 10 + vulnStats.high * 5 + vulnStats.medium * 2 + vulnStats.low * 0.5) / totalScans
    ))
    : 0;

  const getRiskLevel = (score) => {
    if (score >= 75) return { label: 'CRITICAL', color: 'from-red-600 to-red-800', textColor: 'text-red-400', borderColor: 'border-red-500/50' };
    if (score >= 50) return { label: 'HIGH', color: 'from-orange-600 to-red-600', textColor: 'text-orange-400', borderColor: 'border-orange-500/50' };
    if (score >= 25) return { label: 'MEDIUM', color: 'from-yellow-600 to-orange-600', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/50' };
    return { label: 'LOW', color: 'from-green-600 to-teal-600', textColor: 'text-green-400', borderColor: 'border-green-500/50' };
  };

  const riskLevel = getRiskLevel(riskScore);

  // 평균 스캔 시간 계산
  const scanTimes = filteredScans
    .filter(s => s.scan_results?.usage?.total_time)
    .map(s => s.scan_results.usage.total_time);
  const avgScanTime = scanTimes.length > 0
    ? (scanTimes.reduce((a, b) => a + b, 0) / scanTimes.length).toFixed(1)
    : 0;

  // 시간대별 스캔 분석
  const hourCounts = new Array(24).fill(0);
  filteredScans.forEach(scan => {
    if (scan.created_at) {
      const hour = new Date(scan.created_at).getHours();
      hourCounts[hour]++;
    }
  });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  // 스캔 타입별 통계
  const scanTypeStats = {};
  filteredScans.forEach(scan => {
    const type = scan.scan_type || 'Unknown';
    if (!scanTypeStats[type]) {
      scanTypeStats[type] = { count: 0, vulnerabilities: 0, critical: 0, high: 0, medium: 0, low: 0 };
    }
    scanTypeStats[type].count++;
    scanTypeStats[type].vulnerabilities += (scan.vulnerabilities_found || 0);
    scanTypeStats[type].critical += (scan.critical || 0);
    scanTypeStats[type].high += (scan.high || 0);
    scanTypeStats[type].medium += (scan.medium || 0);
    scanTypeStats[type].low += (scan.low || 0);
  });

  // 타임라인 데이터
  const timelineData = [];
  for (let i = timeFilter - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayScans = filteredScans.filter(s => {
      if (!s.created_at) return false;
      return s.created_at.split('T')[0] === dateStr;
    });

    timelineData.push({
      date: dateStr,
      scans: dayScans.length,
      critical: dayScans.reduce((sum, s) => sum + (s.critical || 0), 0),
      high: dayScans.reduce((sum, s) => sum + (s.high || 0), 0),
      medium: dayScans.reduce((sum, s) => sum + (s.medium || 0), 0),
      low: dayScans.reduce((sum, s) => sum + (s.low || 0), 0)
    });
  }

  // 최근 스캔
  const recentScans = [...filteredScans]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 10);

  // High-Risk 스캔
  const topVulnerableScans = [...filteredScans]
    .filter(s => s.vulnerabilities_found > 0)
    .sort((a, b) => (b.vulnerabilities_found || 0) - (a.vulnerabilities_found || 0))
    .slice(0, 5);

  // AI 분석 인사이트 추출
  const aiInsights = {
    totalTokens: 0,
    totalTools: 0,
    avgTokensPerScan: 0,
    avgToolsPerScan: 0,
    totalAnalysisTime: 0,
    mostUsedTool: null,
    vulnerableFiles: new Set(),
    vulnerableFunctions: new Set()
  };

  filteredScans.forEach(scan => {
    if (scan.scan_results) {
      if (scan.scan_results.usage) {
        aiInsights.totalTokens += scan.scan_results.usage.total_tokens || 0;
        aiInsights.totalAnalysisTime += scan.scan_results.usage.total_time || 0;
      }

      if (scan.scan_results.tool_usage) {
        aiInsights.totalTools += scan.scan_results.tool_usage.total_calls || 0;

        const tools = scan.scan_results.tool_usage.tools_used || {};
        Object.entries(tools).forEach(([tool, count]) => {
          if (!aiInsights.mostUsedTool || count > aiInsights.mostUsedTool.count) {
            aiInsights.mostUsedTool = { name: tool, count };
          }
        });
      }

      if (scan.scan_results.content) {
        const content = scan.scan_results.content;
        const fileMatches = content.match(/[\w\/]+\.py/g);
        if (fileMatches) {
          fileMatches.forEach(file => aiInsights.vulnerableFiles.add(file));
        }

        const funcMatches = content.match(/`(\w+)`/g);
        if (funcMatches) {
          funcMatches.forEach(func => {
            const clean = func.replace(/`/g, '');
            if (clean.includes('_') || clean.match(/^[a-z]/)) {
              aiInsights.vulnerableFunctions.add(clean);
            }
          });
        }
      }
    }
  });

  aiInsights.avgTokensPerScan = completedScans > 0 ? Math.round(aiInsights.totalTokens / completedScans) : 0;
  aiInsights.avgToolsPerScan = completedScans > 0 ? (aiInsights.totalTools / completedScans).toFixed(1) : 0;

  // Status 뱃지 색상
  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-300 border-green-500/50';
      case 'failed': return 'bg-red-500/20 text-red-300 border-red-500/50';
      case 'running': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/50';
    }
  };

  const getStatusKorean = (status) => {
    switch (status) {
      case 'completed': return 'Complete';
      case 'failed': return 'Failed';
      case 'running': return 'Running';
      default: return 'Pending';
    }
  };

  // 테마 클래스 정의 - SonarQube 스타일 (정적이고 깔끔함)
  const theme = isDark ? {
    // Dark Theme
    bg: 'bg-gray-900',
    cardBg: 'bg-gray-800',
    cardBgHover: 'bg-gray-750',
    text: 'text-gray-100',
    textSecondary: 'text-gray-400',
    textMuted: 'text-gray-500',
    border: 'border-gray-700',
    borderHover: 'border-gray-600',
    shadow: 'shadow-sm',
    accentText: 'text-blue-400',
    accentBg: 'bg-blue-900/30',
  } : {
    // Light Theme - SonarQube 깔끔한 화이트톤
    bg: 'bg-gray-50',
    cardBg: 'bg-white',
    cardBgHover: 'bg-gray-50',
    text: 'text-gray-900',
    textSecondary: 'text-gray-600',
    textMuted: 'text-gray-500',
    border: 'border-gray-200',
    borderHover: 'border-gray-300',
    shadow: 'shadow-sm',
    accentText: 'text-blue-600',
    accentBg: 'bg-blue-50',
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <div className={theme.text}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} relative`}>
      <AppNavbar
        user={user}
        handleLogout={handleLogout}
        breadcrumb={{
          items: [
            { label: '프로젝트', to: '/home' },
            { label: '스캔', to: `/project/${id}/scans` },
            { label: '분석' }
          ]
        }}
      />

      <main className="pt-20 pb-6 px-6 max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-1`}>
              Scan Analytics Dashboard
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>실시간 취약점 인텔리전스 & 위협 모니터링</p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Time Filter */}
            <div className={`flex items-center space-x-1 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg p-1`}>
              {[7, 30].map(days => (
                <button
                  key={days}
                  onClick={() => setTimeFilter(days)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${timeFilter === days
                    ? 'bg-indigo-600 text-white'
                    : `${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
                    }`}
                >
                  {days}일
                </button>
              ))}
            </div>

            <Link
              to={`/project/${id}/scans`}
              className={`px-4 py-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium text-xs rounded-lg transition-colors flex items-center space-x-1.5`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </Link>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-3">
          {/* === Row 1: Main KPIs === */}
          <MetricCard
            type="risk"
            data={{ riskScore, riskLevel, totalScans, totalVulnerabilities }}
            theme={theme}
            isDark={isDark}
          />

          <MetricCard
            type="scans"
            data={{ totalScans, completedScans, runningScans, failedScans, timelineData }}
            theme={theme}
            isDark={isDark}
          />

          <MetricCard
            type="vulnerabilities"
            data={{ totalVulnerabilities, vulnStats }}
            theme={theme}
            isDark={isDark}
          />

          <MetricCard
            type="scanTime"
            data={{ avgScanTime, peakHour }}
            theme={theme}
            isDark={isDark}
          />

          {/* === Row 2: AI Analysis Insights === */}

          {/* AI Performance Metrics */}
          <div className={`col-span-4 ${theme.cardBg} border ${theme.border} rounded-lg p-5 ${theme.shadow} hover:${theme.borderHover} transition-colors`}>
            <h3 className={`text-sm font-semibold ${theme.text} mb-4 flex items-center`}>
              <div className={`w-1 h-5 ${theme.accentBg} rounded mr-2.5`}></div>
              AI 분석 통계
            </h3>

            <div className="space-y-3">
              <div className={`${theme.cardBgHover} border ${theme.border} rounded p-3 hover:${theme.borderHover} transition-colors`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs ${theme.textSecondary} font-medium`}>처리된 총 Token 수</span>
                  <span className={`text-xs font-semibold ${theme.accentText}`}>{aiInsights.avgTokensPerScan} 평균/스캔</span>
                </div>
                <div className={`text-2xl font-bold ${theme.text} mb-1`}>{aiInsights.totalTokens.toLocaleString()}</div>
                <div className={`h-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded overflow-hidden`}>
                  <div className="h-full bg-blue-600 rounded" style={{ width: '75%' }}></div>
                </div>
              </div>

              <div className={`${theme.cardBgHover} border ${theme.border} rounded p-3 hover:${theme.borderHover} transition-colors`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs ${theme.textSecondary} font-medium`}>총 분석 시간</span>
                  <span className={`text-xs font-semibold ${theme.accentText}`}>{completedScans > 0 ? (aiInsights.totalAnalysisTime / completedScans).toFixed(1) : 0}초 평균</span>
                </div>
                <div className={`text-2xl font-bold ${theme.text}`}>{aiInsights.totalAnalysisTime.toFixed(1)}s</div>
              </div>

              <div className={`${theme.cardBgHover} border ${theme.border} rounded p-3 hover:${theme.borderHover} transition-colors`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs ${theme.textSecondary} font-medium`}>호출된 도구(Tools)</span>
                  <span className={`text-xs font-semibold ${theme.accentText}`}>{aiInsights.avgToolsPerScan} 평균/스캔</span>
                </div>
                <div className="flex items-baseline space-x-2">
                  <div className={`text-2xl font-bold ${theme.text}`}>{aiInsights.totalTools}</div>
                  {aiInsights.mostUsedTool && (
                    <span className={`text-xs ${theme.textSecondary}`}>
                      Most: <span className={`font-semibold ${theme.accentText}`}>{aiInsights.mostUsedTool.name}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Vulnerable Code Insights */}
          <div className={`col-span-4 ${theme.cardBg} border ${theme.border} rounded-lg p-5 ${theme.shadow} hover:${theme.borderHover} transition-colors`}>
            <h3 className={`text-sm font-semibold ${theme.text} mb-4 flex items-center`}>
              <div className={`w-1 h-5 bg-orange-100 rounded mr-2.5`}></div>
              취약 코드 패턴
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>영향받은 파일</span>
                  <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full text-xs font-bold">{aiInsights.vulnerableFiles.size}</span>
                </div>
                {aiInsights.vulnerableFiles.size > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {Array.from(aiInsights.vulnerableFiles).slice(0, 5).map((file, idx) => (
                      <div key={idx} className={`${theme.cardBgHover} border ${theme.border} rounded px-2.5 py-1.5 flex items-center space-x-2 hover:${theme.borderHover} transition-colors`}>
                        <svg className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className={`text-xs font-mono ${theme.text} truncate`}>{file}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted} text-center py-2`}>감지된 파일 없음</div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>취약 함수</span>
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full text-xs font-bold">{aiInsights.vulnerableFunctions.size}</span>
                </div>
                {aiInsights.vulnerableFunctions.size > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(aiInsights.vulnerableFunctions).slice(0, 8).map((func, idx) => (
                      <span key={idx} className={`px-2 py-1 ${isDark ? 'bg-red-500/20 text-red-200 border-red-500/40' : 'bg-red-100 text-red-700 border-red-300'} border rounded text-xs font-mono font-semibold hover:${isDark ? 'bg-red-500/30' : 'bg-red-200'} transition-colors`}>
                        {func}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted} text-center py-2`}>감지된 함수 없음</div>
                )}
              </div>
            </div>
          </div>

          {/* LLM Reasoning Insights */}
          <div className={`col-span-4 ${theme.cardBg} border border-teal-500/20 rounded-lg p-5 ${theme.shadow} shadow-sm hover:shadow-md hover:border-teal-500/30 transition-all duration-400`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center`}>
              <div className="w-1 h-5 bg-gray-200 rounded-full mr-2.5"></div>
              최신 AI 분석 내용
            </h3>

            {recentScans.length > 0 && recentScans[0].scan_results?.reasoning?.summary ? (
              <div className="space-y-3">
                <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}  border border-teal-500/10 rounded-lg p-3 hover:border-teal-500/30 hover:${theme.cardBgHover} transition-all duration-300`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1.5 bg-teal-500/20 rounded">
                      <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-teal-300">AI Thinking Process</span>
                  </div>
                  <p className={`text-xs ${theme.textSecondary} leading-relaxed line-clamp-6`}>
                    {recentScans[0].scan_results.reasoning.summary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '분석 단계', value: recentScans[0].scan_results.tool_usage?.call_sequence?.length || 0 },
                    { label: '사용된 도구', value: Object.keys(recentScans[0].scan_results.tool_usage?.tools_used || {}).length }
                  ].map((item, idx) => (
                    <div key={idx} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}  border border-teal-500/10 rounded-lg p-2.5 text-center hover:border-teal-500/30 hover:${theme.cardBgHover} transition-all duration-300`}>
                      <div className={`text-xs ${theme.textSecondary} mb-1`}>{item.label}</div>
                      <div className={`text-xl font-bold ${theme.text}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`text-center py-12 ${theme.textMuted}`}>
                <svg className="w-14 h-14 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-sm">AI 분석 데이터가 없습니다</p>
              </div>
            )}
          </div>

          {/* === Row 3: Timeline Chart === */}
          <div className="col-span-12">
            <VulnerabilityTrendChart timelineData={timelineData} isDark={isDark} />
          </div>

          {/* === Row 4: Scan Type Analysis & Top Scans === */}

          {/* Scan Type Heatmap */}
          <div className={`col-span-7 ${theme.cardBg} border ${theme.border} rounded-lg p-5 ${theme.shadow} shadow-sm`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center`}>
              <div className={`w-1 h-5 bg-gradient-to-b ${isDark ? 'from-cyan-500 to-teal-500' : 'from-blue-500 to-purple-500'} rounded-full mr-2.5`}></div>
              Scan 유형 분석
            </h3>

            <div className="space-y-3">
              {Object.entries(scanTypeStats).map(([type, stats], idx) => {
                const avgVulns = stats.count > 0 ? (stats.vulnerabilities / stats.count).toFixed(1) : 0;
                return (
                  <div key={type} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}  border ${theme.border} rounded-lg p-3 hover:${theme.borderHover} transition-all`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-bold ${theme.text}`}>{type}</span>
                      <div className="flex items-center space-x-3 text-xs">
                        <span className={theme.textSecondary}>{stats.count} 스캔</span>
                        <span className={`font-bold ${theme.accentText}`}>{avgVulns} 평균 취약점</span>
                      </div>
                    </div>

                    {/* Severity Grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Critical', value: stats.critical, color: 'red', bg: isDark ? 'bg-red-500/20' : 'bg-red-100' },
                        { label: 'High', value: stats.high, color: 'orange', bg: isDark ? 'bg-orange-500/20' : 'bg-orange-100' },
                        { label: 'Medium', value: stats.medium, color: 'yellow', bg: isDark ? 'bg-yellow-500/20' : 'bg-yellow-100' },
                        { label: 'Low', value: stats.low, color: 'green', bg: isDark ? 'bg-green-500/20' : 'bg-green-100' }
                      ].map((sev, i) => (
                        <div key={i} className={`${sev.bg} rounded p-2 text-center hover:scale-105 transition-transform`}>
                          <div className={`text-xs text-${sev.color}-${isDark ? '400' : '700'} font-semibold mb-0.5`}>{sev.label.charAt(0)}</div>
                          <div className={`text-lg font-bold text-${sev.color}-${isDark ? '300' : '600'}`}>{sev.value}</div>
                          <div className={`h-1 ${isDark ? 'bg-slate-600' : 'bg-gray-300'} rounded-full mt-1 overflow-hidden`}>
                            <div className={`h-full bg-${sev.color}-${isDark ? '500' : '600'} transition-all duration-800`} style={{ width: `${stats.vulnerabilities > 0 ? (sev.value / stats.vulnerabilities) * 100 : 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* High-Risk Scans */}
          <div className={`col-span-5 ${theme.cardBg} border ${theme.border} rounded-lg p-5 ${theme.shadow} shadow-sm`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center`}>
              <div className="w-1 h-5 bg-gray-200 rounded-full mr-2.5"></div>
              고위험 Scan
            </h3>

            {topVulnerableScans.length > 0 ? (
              <div className="space-y-2.5">
                {topVulnerableScans.map((scan, idx) => (
                  <Link
                    key={scan.id}
                    to={`/project/${id}/scans`}
                    className={`block ${isDark ? 'bg-gray-700' : 'bg-gray-100'}  border ${theme.border} rounded-lg p-3 hover:border-red-500/40 hover:${theme.shadow} hover: hover:shadow-red-500/10 transition-all duration-400  group`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-red-700 to-orange-700 text-white text-xs font-bold ">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold ${theme.text} truncate group-hover:${theme.accentText} transition-colors`}>
                            {scan.name || scan.scan_type}
                          </div>
                          <div className={`text-xs ${theme.textMuted}`}>
                            {new Date(scan.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="px-2.5 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-bold">
                        {scan.vulnerabilities_found}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className={`text-center py-12 ${theme.textMuted}`}>
                <svg className="w-14 h-14 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">모든 스캔이 안전합니다</p>
              </div>
            )}
          </div>

          {/* === NEW Row: Advanced Analytics === */}

          {/* CVSS Score Distribution */}
          <div className={`col-span-4 ${theme.cardBg} border border-indigo-500/20 rounded-lg p-5 ${theme.shadow} shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all duration-400`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center`}>
              <div className="w-1 h-5 bg-gray-200 rounded-full mr-2.5"></div>
              CVSS 점수 분포
            </h3>

            <div className="space-y-3">
              {cvssItems.map((item, idx) => {
                const palette = isDark ? item.palette.dark : item.palette.light;
                const widthPercent = item.count > 0 ? Math.max((item.count / cvssMax) * 100, 6) : 0;
                const trackClass = isDark
                  ? 'bg-slate-800/70 border border-slate-700/60'
                  : 'bg-slate-100/80 border border-slate-200/60';
                return (
                  <div key={idx} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${palette.badge}`}>
                          {item.label}
                        </span>
                        <span className={`text-xs ${theme.textMuted} font-mono`}>{item.range}</span>
                      </div>
                      <span className={`text-sm font-bold ${palette.count}`}>{item.count}</span>
                    </div>
                    <div className="relative">
                      <div className={`h-8 rounded-lg overflow-hidden transition-colors ${trackClass}`}>
                        <div
                          className={`h-full flex items-center justify-end pr-2 text-[11px] font-semibold tracking-wide rounded-lg ${palette.bar} ${palette.barText}`}
                          style={{
                            width: `${widthPercent}%`,
                            boxShadow: palette.shadow,
                          }}
                        >
                          {item.count > 0 && (
                            <span>{item.count}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Posture Trend */}
          <div className={`col-span-5 ${theme.cardBg} border border-emerald-500/20 rounded-lg p-5 ${theme.shadow} shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-400`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center`}>
              <div className="w-1 h-5 bg-gray-200 rounded-full mr-2.5"></div>
              보안 자세 추이
            </h3>

            <div className="flex items-center justify-between mb-4">
              <div>
                <div className={`text-xs ${theme.textMuted} mb-1`}>현재 보안 점수</div>
                <div className="flex items-baseline space-x-2">
                  <div className={`text-3xl font-bold ${theme.text}`}>{100 - riskScore}</div>
                  <div className={`text-sm ${riskScore <= 25 ? 'text-emerald-400' : riskScore <= 50 ? 'text-yellow-400' : 'text-red-400'} font-bold flex items-center`}>
                    {riskScore <= 25 ? '↑' : riskScore <= 50 ? '→' : '↓'}
                    {Math.abs(riskScore - 50)}%
                  </div>
                </div>
              </div>
              <div className={`p-3 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'} rounded-lg`}>
                <svg className={`w-6 h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>

            {/* Mini Line Chart */}
            <div className="relative h-24">
              <svg width="100%" height="100%" className="overflow-visible">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((y, idx) => (
                  <line
                    key={idx}
                    x1="0"
                    y1={`${y}%`}
                    x2="100%"
                    y2={`${y}%`}
                    stroke={isDark ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)'}
                    strokeWidth="1"
                  />
                ))}

                {/* Security Score Line */}
                <polyline
                  points={timelineData.slice(-7).map((data, idx) => {
                    const total = data.critical + data.high + data.medium + data.low;
                    const score = total > 0 ? Math.max(0, 100 - (data.critical * 10 + data.high * 5 + data.medium * 2 + data.low * 0.5)) : 100;
                    const x = (idx / 6) * 100;
                    const y = 100 - score;
                    return `${x}%,${y}%`;
                  }).join(' ')}
                  fill="none"
                  stroke={isDark ? '#10b981' : '#059669'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="drop-"
                />

                {/* Data points */}
                {timelineData.slice(-7).map((data, idx) => {
                  const total = data.critical + data.high + data.medium + data.low;
                  const score = total > 0 ? Math.max(0, 100 - (data.critical * 10 + data.high * 5 + data.medium * 2 + data.low * 0.5)) : 100;
                  const x = (idx / 6) * 100;
                  const y = 100 - score;
                  return (
                    <circle
                      key={idx}
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r="4"
                      fill={isDark ? '#10b981' : '#059669'}
                      stroke="white"
                      strokeWidth="2"
                      className="hover:r-6 transition-all cursor-pointer"
                    />
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between mt-3 text-xs">
              {timelineData.slice(-7).map((data, idx) => (
                <span key={idx} className={theme.textMuted}>{data.date.slice(8, 10)}</span>
              ))}
            </div>
          </div>

          {/* Compliance Dashboard */}
          <div className={`col-span-3 ${theme.cardBg} border border-blue-500/20 rounded-lg p-5 ${theme.shadow} shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all duration-400`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center`}>
              <div className="w-1 h-5 bg-gray-200 rounded-full mr-2.5"></div>
              컴플라이언스
            </h3>

            {/* Overall Score */}
            <div className="mb-4 text-center">
              <div className={`text-xs ${theme.textMuted} mb-2`}>전체 준수율</div>
              <div className="relative w-32 h-32 mx-auto">
                <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={isDark ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)'}
                    strokeWidth="10"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={riskScore < 30 ? '#10b981' : riskScore < 60 ? '#eab308' : '#ef4444'}
                    strokeWidth="10"
                    strokeDasharray={`${(100 - riskScore) / 100 * 314} 314`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={`text-2xl font-bold ${theme.text}`}>{100 - riskScore}%</div>
                  <div className={`text-xs ${theme.textMuted}`}>Score</div>
                </div>
              </div>
            </div>

            {/* Compliance Items */}
            <div className="space-y-2">
              {[
                { standard: 'OWASP Top 10', score: Math.min(100, 100 - riskScore + 10), icon: '🛡️' },
                { standard: 'CWE Standards', score: Math.min(100, 100 - riskScore + 5), icon: '📋' },
                { standard: 'Security Best Practice', score: Math.min(100, 100 - riskScore), icon: '✅' }
              ].map((item, idx) => (
                <div key={idx} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-2.5 border ${theme.border} hover:${theme.borderHover} transition-all`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1.5">
                      <span>{item.icon}</span>
                      <span className={`text-xs font-semibold ${theme.text}`}>{item.standard}</span>
                    </div>
                    <span className={`text-xs font-bold ${item.score >= 80 ? 'text-emerald-400' : item.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {item.score}%
                    </span>
                  </div>
                  <div className={`h-1.5 ${isDark ? 'bg-slate-700' : 'bg-gray-300'} rounded-full overflow-hidden`}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${item.score >= 80 ? 'bg-emerald-500' : item.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* === Row 5: Recent Activity === */}
          <div className={`col-span-12 ${theme.cardBg} border ${theme.border} rounded-lg p-5 ${theme.shadow} shadow-sm`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center`}>
              <div className={`w-1 h-5 bg-gradient-to-b ${isDark ? 'from-blue-500 to-indigo-500' : 'from-purple-500 to-pink-500'} rounded-full mr-2.5`}></div>
              최근 활동 로그
            </h3>

            {recentScans.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {recentScans.map((scan, idx) => (
                  <Link
                    key={scan.id}
                    to={`/project/${id}/scans`}
                    className={`block ${isDark ? 'bg-gray-700' : 'bg-gray-100'}  border ${theme.border} rounded-lg p-3 hover:${theme.borderHover} hover:${theme.shadow} hover: transition-all duration-400 `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-bold ${theme.text} truncate flex-1`}>{scan.name || scan.scan_type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ml-2 ${getStatusBadge(scan.status)}`}>
                        {getStatusKorean(scan.status)}
                      </span>
                    </div>
                    <div className={`text-xs ${theme.textMuted} mb-2`}>{new Date(scan.created_at).toLocaleString()}</div>
                    {scan.vulnerabilities_found > 0 && (
                      <div className="flex items-center space-x-2">
                        <div className={`flex-1 h-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-300'} rounded-full overflow-hidden`}>
                          <div className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 transition-all duration-800" style={{ width: '70%' }}></div>
                        </div>
                        <span className={`text-xs font-bold ${theme.accentText}`}>{scan.vulnerabilities_found}</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className={`text-center py-12 ${theme.textMuted}`}>
                <svg className="w-14 h-14 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </main>

    </div>
  );
}

export default ScansDashboard;

