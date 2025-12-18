import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';
import projectService from '../services/projectService';
import scanService from '../services/scanService';
import ProjectNavbar from '../components/common/ProjectNavbar';
import { useTheme } from '../hooks/useTheme';
import ProjectHero from '../components/project/ProjectHero';
import ProjectKpiGrid from '../components/project/ProjectKpiGrid';
import ProjectAnalyticsGrid from '../components/project/ProjectAnalyticsGrid';
// import ProjectTaintFlowSummary from '../components/project/ProjectTaintFlowSummary';
import ProjectScanModal from '../components/project/ProjectScanModal';
import { collectVulnerabilities, normalizeScanSummary } from '../components/scans/scanDetailUtils';

function ProjectDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const defaultScanForm = {
    mode: 'custom',
    source_type: 'git',
    github_url: '',
    scan_type: 'ALL',
    discovery_mode: 'off',
    verifier_mode: 'off',
    preset_advanced: false,
    preset_provider: 'openrouter',
    preset_model: 'x-ai/grok-4.1-fast',
    preset_model_mode: 'select',
    preset_endpoint: '',
    preset_api_key: '',
    preset_headers: '',
    custom_advanced: false,
    custom_provider: 'openrouter',
    custom_model: 'x-ai/grok-4.1-fast',
    custom_model_mode: 'select',
    custom_endpoint: '',
    custom_api_key: '',
    custom_headers: '',
    run_sast: true,
    upload_file: null,
    notify_enabled: false,
    notify_emails: [],
  };

  const [user, setUser] = useState(null);
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState({
    total_scans: 0,
    completed_scans: 0,
    pending_scans: 0,
    total_vulnerabilities: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanForm, setScanForm] = useState({ ...defaultScanForm });
  const [scanSubmitting, setScanSubmitting] = useState(false);
  const [scanStatus, setScanStatus] = useState('idle');
  const [scanMessage, setScanMessage] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const trendSummaryCards = useMemo(() => {
    const avgIssues = stats.total_scans ? Math.round(stats.total_vulnerabilities / stats.total_scans) : 0;
    return [
      {
        id: 'avg-issues',
        label: '평균 이슈',
        value: avgIssues,
        accent: 'indigo'
      },
      {
        id: 'recent-scans',
        label: '최근 스캔',
        value: stats.total_scans,
        accent: 'emerald'
      }
    ];
  }, [stats.total_scans, stats.total_vulnerabilities]);

  const latestTaintFlow = useMemo(() => {
    if (!Array.isArray(scans) || scans.length === 0) {
      return null;
    }

    let latestEntry = null;
    let latestTimestamp = null;

    const parseCompletedDate = (scan) => {
      const raw = scan.completed_at || scan.started_at || scan.created_at;
      if (!raw) return null;
      const date = new Date(raw);
      return Number.isNaN(date.valueOf()) ? null : date;
    };

    scans.forEach((scan) => {
      if (scan.status !== 'completed') return;
      const completedDate = parseCompletedDate(scan);
      if (!completedDate) return;
      if (!latestTimestamp || completedDate > latestTimestamp) {
        latestTimestamp = completedDate;
        latestEntry = scan;
      }
    });

    if (!latestEntry) {
      return null;
    }

    const normalizeFlow = (flow) => {
      if (!flow || typeof flow !== 'object') return null;
      const sources = typeof flow.sources === 'number' ? flow.sources : 0;
      const propagations = typeof flow.propagations === 'number' ? flow.propagations : 0;
      const sinks = typeof flow.sinks === 'number' ? flow.sinks : 0;
      const topPaths = Array.isArray(flow.top_paths)
        ? flow.top_paths
            .filter(
              (path) =>
                path &&
                typeof path === 'object' &&
                (path.source || path.sink || path.description)
            )
            .map((path) => ({
              source: String(path.source || '').trim() || 'N/A',
              sink: String(path.sink || '').trim() || 'N/A',
              risk: String(path.risk || '').trim().toLowerCase() || 'medium',
              description: String(path.description || '').trim(),
            }))
        : [];

      if (sources + propagations + sinks === 0 && topPaths.length === 0) {
        return null;
      }

      return {
        sources,
        propagations,
        sinks,
        top_paths: topPaths.slice(0, 5),
      };
    };

    const explicit = normalizeFlow(
      latestEntry.scan_results?.taint_flow ||
        latestEntry.scan_results?.structured_result?.taint_flow
    );
    if (explicit) {
      return explicit;
    }

    const structured = latestEntry.scan_results?.structured_result;
    let vulnerabilities = [];
    if (structured?.vulnerabilities?.length) {
      vulnerabilities = collectVulnerabilities(structured);
    } else {
      vulnerabilities = collectVulnerabilities(
        latestEntry.scan_results?.content,
        latestEntry.scan_results?.vulnerability_names
      );
    }

    if (!vulnerabilities.length) {
      return null;
    }

    let sources = 0;
    let propagations = 0;
    let sinks = 0;

    const pathMap = new Map();

    vulnerabilities.forEach((vuln, index) => {
      const taint = vuln.taint_flow;
      if (!taint || typeof taint !== 'object') {
        return;
      }

      if (Array.isArray(taint.segments)) {
        taint.segments.forEach((segment) => {
          if (!segment || typeof segment !== 'object') return;
          const stage = String(segment.stage || '').trim().toLowerCase();
          if (stage === 'source') sources += 1;
          else if (stage === 'propagation') propagations += 1;
          else if (stage === 'sink') sinks += 1;
        });
      } else {
        if (taint.source) sources += 1;
        if (taint.sink) sinks += 1;
      }

      const sourceLabel =
        String(taint.source || '').trim() ||
        taint.segments?.find((segment) => segment.stage === 'source')?.title ||
        vuln.file_path ||
        'Source';

      const sinkLabel =
        String(taint.sink || '').trim() ||
        [...(taint.segments || [])]
          .reverse()
          .find((segment) => segment.stage === 'sink')?.title ||
        vuln.file_path ||
        'Sink';

      const risk = ['critical', 'high', 'medium', 'low'].includes(
        (taint.risk || '').toLowerCase()
      )
        ? taint.risk.toLowerCase()
        : vuln.severity || 'medium';

      const description =
        taint.description ||
        vuln.description ||
        `${sourceLabel} → ${sinkLabel}`;

      const key = `${sourceLabel}=>${sinkLabel}`;
      if (!pathMap.has(key)) {
        pathMap.set(key, {
          source: sourceLabel,
          sink: sinkLabel,
          risk,
          description,
          occurrences: 0,
          latestIndex: index,
        });
      }
      const entry = pathMap.get(key);
      entry.occurrences += 1;
      entry.latestIndex = Math.max(entry.latestIndex, index);
      if (!entry.description && description) {
        entry.description = description;
      }
      entry.risk = entry.risk || risk;
    });

    if (sources + propagations + sinks === 0 && pathMap.size === 0) {
      return null;
    }

    const topPaths = Array.from(pathMap.values())
      .sort((a, b) => {
        if (b.occurrences !== a.occurrences) {
          return b.occurrences - a.occurrences;
        }
        return a.latestIndex - b.latestIndex;
      })
      .map((entry) => ({
        source: entry.source,
        sink: entry.sink,
        risk: entry.risk || 'medium',
        description: entry.description,
        occurrences: entry.occurrences,
      }))
      .slice(0, 5);

    return {
      sources,
      propagations,
      sinks,
      top_paths: topPaths,
    };
  }, [scans]);

  useEffect(() => {
    const init = async () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    };
    init();
    loadProject();
    loadStats();
  }, [id]);

  useEffect(() => {
    // 백엔드 DB의 정규화된 취약점을 스캔별로 조회해 대시보드 분석에 사용
    const fetchVulnerabilities = async () => {
      if (!Array.isArray(scans) || scans.length === 0) {
        setVulnerabilities([]);
        return;
      }

      const completed = scans.filter((s) => s.status === 'completed');
      if (completed.length === 0) {
        setVulnerabilities([]);
        return;
      }

      try {
        const results = await Promise.all(
          completed.map((scan) =>
            scanService.getScanVulnerabilities(id, scan.id).catch(() => [])
          )
        );
        setVulnerabilities(results.flat());
      } catch (err) {
        console.error('Failed to load vulnerabilities for project dashboard:', err);
        setVulnerabilities([]);
      }
    };

    fetchVulnerabilities();
  }, [id, scans]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await projectService.getProject(id);
      setProject(data);
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // 프로젝트의 모든 스캔 가져오기 및 structured_result 기반 카운트 보정
      const scanData = await scanService.getScans(id);
      const normalizedScans = (scanData || []).map(normalizeScanSummary);

      setScans(normalizedScans); // 스캔 데이터 저장
      
      // 통계 계산
      const total_scans = normalizedScans.length;
      const completed_scans = normalizedScans.filter((s) => s.status === 'completed').length;
      const pending_scans = normalizedScans.filter((s) => s.status !== 'completed' && s.status !== 'failed').length;
      
      const total_vulnerabilities = normalizedScans.reduce((sum, s) => sum + (s.vulnerabilities_found || 0), 0);
      const critical = normalizedScans.reduce((sum, s) => sum + (s.critical || 0), 0);
      const high = normalizedScans.reduce((sum, s) => sum + (s.high || 0), 0);
      const medium = normalizedScans.reduce((sum, s) => sum + (s.medium || 0), 0);
      const low = normalizedScans.reduce((sum, s) => sum + (s.low || 0), 0);
      
      setStats({
        total_scans,
        completed_scans,
        pending_scans,
        total_vulnerabilities,
        critical,
        high,
        medium,
        low
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleScanChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    let nextValue = value;

    if (type === 'checkbox') {
      nextValue = checked;
    } else if (type === 'file') {
      if (files && files.length > 0) {
        const file = files[0];
        // 파일 객체가 제대로 있는지 확인
        if (file && file.size !== undefined) {
          nextValue = file;
          console.log('File selected:', file.name, 'Size:', file.size, 'bytes');
        } else {
          console.warn('File object is invalid:', file);
          nextValue = null;
        }
      } else {
        nextValue = null;
      }
    }

    setScanForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const triggerScan = async () => {
    setScanMessage('');

    const sourceType = scanForm.source_type || 'git';
    const repoUrl = (scanForm.github_url || '').trim();
    const uploadedFile = scanForm.upload_file;

    if (sourceType === 'git') {
      if (!repoUrl) {
        setScanMessage('GitHub URL을 입력해주세요');
        return;
      }
    } else if (sourceType === 'upload') {
      if (!uploadedFile) {
        setScanMessage('분석할 프로젝트 파일을 업로드해주세요');
        return;
      }
      // 파일 업로드 처리는 아래에서 진행
    }

    const mode = scanForm.mode;
    const isCustom = mode === 'custom';
    const provider = (
      isCustom ? scanForm.custom_provider :
      scanForm.preset_provider || ''
    ).trim();
    const model = (
      isCustom ? scanForm.custom_model :
      scanForm.preset_model || ''
    ).trim();

    if (!provider || !model) {
      setScanMessage('사용할 Provider와 모델을 선택하거나 입력해주세요');
      return;
    }

    const notifyEnabled = Boolean(scanForm.notify_enabled);
    const notifyEmails = Array.isArray(scanForm.notify_emails) ? scanForm.notify_emails : [];
    const trimmedEmails = notifyEmails.map((email) => (email || '').trim()).filter(Boolean);
    if (notifyEnabled) {
      if (!trimmedEmails.length) {
        setScanMessage('이메일 알림을 켜면 주소를 하나 이상 입력해주세요');
        return;
      }
      const invalidEmail = trimmedEmails.find((email) => !emailRegex.test(email));
      if (invalidEmail) {
        setScanMessage(`이메일 주소를 확인해주세요: ${invalidEmail}`);
        return;
      }
    }

    // profile_mode 결정: 각 스캔 타입 내에서 preset/custom 구분
    // Quick Scan (mode='preset'): preset_advanced off → 'preset', on → 'custom'
    // Full Scan (mode='custom'): custom_advanced off → 'preset', on → 'custom'
    let profileMode;
    if (mode === 'preset') {
      // Quick Scan: preset_advanced 토글로 구분
      profileMode = scanForm.preset_advanced ? 'custom' : 'preset';
    } else if (mode === 'custom') {
      // Full Scan: custom_advanced 토글로 구분
      profileMode = scanForm.custom_advanced ? 'custom' : 'preset';
    } else {
      profileMode = 'preset';
    }

    // 파일 업로드 처리
    let uploadedFilePath = null;
    let projectName = null;
    
    if (sourceType === 'upload') {
      setScanSubmitting(true);
      setScanMessage('파일 업로드 중...');
      
      try {
        // FormData로 파일 업로드
        const formData = new FormData();
        formData.append('file', uploadedFile);
        
        const uploadResponse = await scanService.uploadProjectFile(id, formData);
        uploadedFilePath = uploadResponse.file_path;
        projectName = uploadResponse.project_name;
        
        setScanMessage('파일 업로드 완료. 스캔 시작 중...');
      } catch (error) {
        setScanMessage(error.response?.data?.detail || '파일 업로드 실패');
        setScanSubmitting(false);
        return;
      }
    }

    const payload = {
      source_type: sourceType,
      github_url: sourceType === 'git' ? repoUrl : undefined,
      uploaded_file_path: sourceType === 'upload' ? uploadedFilePath : undefined,
      project_name: sourceType === 'upload' ? projectName : undefined,
      discovery_mode: scanForm.discovery_mode,
      verifier_mode: scanForm.verifier_mode,
      scan_type: scanForm.scan_type,
      api_provider: provider,
      model,
      run_sast: scanForm.run_sast,
      scan_mode: mode, // Quick Scan ('preset') vs Full Scan ('custom')
      profile_mode: profileMode, // 각 스캔 타입 내에서 preset/custom 구분 (고급 설정 on/off)
      preset_advanced: scanForm.preset_advanced,
      custom_advanced: scanForm.custom_advanced,
    };
    if (notifyEnabled) {
      payload.notify_emails = trimmedEmails;
    }

    // LLM endpoint/API key 전달 (백엔드 → Jenkins)
    let endpoint = '';
    let apiKey = '';
    if (isCustom) {
      endpoint = (scanForm.custom_endpoint || '').trim();
      apiKey = (scanForm.custom_api_key || '').trim();
      const customConfig = {
        endpoint,
        api_key: apiKey,
        headers: (scanForm.custom_headers || '').trim(),
      };
      const filteredConfig = Object.fromEntries(
        Object.entries(customConfig).filter(([, value]) => value)
      );
      if (Object.keys(filteredConfig).length > 0) {
        payload.custom_config = filteredConfig;
      }
    } else if (scanForm.preset_advanced) {
      endpoint = (scanForm.preset_endpoint || '').trim();
      apiKey = (scanForm.preset_api_key || '').trim();
      const presetConfig = {
        endpoint,
        api_key: apiKey,
        headers: (scanForm.preset_headers || '').trim(),
      };
      const filteredPresetConfig = Object.fromEntries(
        Object.entries(presetConfig).filter(([, value]) => value)
      );
      if (Object.keys(filteredPresetConfig).length > 0) {
        payload.custom_config = filteredPresetConfig;
      }
    }
    if (endpoint) payload.llm_endpoint_url = endpoint;
    if (apiKey) payload.llm_api_key = apiKey;

    try {
      setScanSubmitting(true);
      setScanStatus('running');
      const res = await scanService.triggerScan(id, payload);
      setCurrentScanId(res.id); // 스캔 ID 저장
      setScanMessage(`스캔이 시작되었습니다 (id: ${res.id}, status: ${res.status})`);
      await loadStats();
      // 모달은 계속 열어두고 진행 상황을 표시
    } catch (err) {
      setScanMessage(typeof err === 'string' ? err : (err?.response?.data?.detail || '스캔 시작에 실패했습니다'));
      setScanSubmitting(false);
      setScanStatus('failed');
      setCurrentScanId(null);
    }
  };

  const closeScanModal = () => {
    setShowScanModal(false);
    setScanMessage('');
    setScanForm({ ...defaultScanForm });
    setCurrentScanId(null);
    setScanSubmitting(false);
    setScanStatus('idle');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EAF2FF] flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800' : 'bg-[#EAF2FF]'}`}>
      {isDark ? (
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
        </div>
      ) : (
        <div className="fixed inset-0 -z-10 bg-[#EAF2FF]" />
      )}

      <ProjectNavbar
        projectId={id}
        projectName={project?.name}
        user={user}
        handleLogout={handleLogout}
        triggerMode={project?.trigger_mode}
      />

      {/* Main Content */}
      <main className="pt-36 px-8 pb-10">
        <div className="max-w-[1400px] mx-auto">
          <ProjectHero
            isDark={isDark}
            project={project}
            onNewScan={() => setShowScanModal(true)}
            onCreateReport={() => {}}
          />

          <ProjectKpiGrid stats={stats} />

          {/* Analytics Section - Completely Redesigned */}
          <ProjectAnalyticsGrid
            isDark={isDark}
            scans={scans}
            vulnerabilities={vulnerabilities}
            trendSummaryCards={trendSummaryCards}
          />

          {/* <ProjectTaintFlowSummary isDark={isDark} taintFlow={latestTaintFlow} /> */}
        </div>
      </main>

      {showScanModal && (
        <ProjectScanModal
          scanForm={scanForm}
          scanMessage={scanMessage}
          scanSubmitting={scanSubmitting}
          scanStatus={scanStatus}
          onClose={closeScanModal}
          onChange={handleScanChange}
          onSubmit={triggerScan}
          isDark={isDark}
          projectId={id}
          scanId={currentScanId}
          onPipelineFinished={(status) => {
            setScanStatus(status);
            setScanSubmitting(false);
          }}
        />
      )}
    </div>
  );
}

export default ProjectDashboard;
