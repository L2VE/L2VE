import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import projectService from '../services/projectService';
import scanService from '../services/scanService';
import ProjectNavbar from '../components/common/ProjectNavbar';
import { useTheme } from '../hooks/useTheme';
import ScansHero from '../components/scans/ScansHero';
import ScanGridCard from '../components/scans/ScanGridCard';
import ScanListItem from '../components/scans/ScanListItem';
import ProjectScanModal from '../components/project/ProjectScanModal';
import ScanDetailModal from '../components/scans/ScanDetailModal';
import { normalizeScanSummary } from '../components/scans/scanDetailUtils';
import { mutedText } from '../utils/themeStyles';

function Scans() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [project, setProject] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanStatus, setScanStatus] = useState('idle');
  const [currentScanId, setCurrentScanId] = useState(null);

  const statusBadgeClasses = isDark
    ? {
      completed: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/40',
      running: 'bg-blue-500/15 text-blue-200 border border-blue-400/40',
      failed: 'bg-rose-500/15 text-rose-200 border border-rose-400/40',
      queued: 'bg-yellow-500/15 text-yellow-200 border border-yellow-400/40'
    }
    : {
      completed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      running: 'bg-blue-100 text-blue-700 border border-blue-200',
      failed: 'bg-rose-100 text-rose-700 border border-rose-200',
      queued: 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    };

  const defaultScanConfig = {
    mode: 'custom',
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
    notify_enabled: false,
    notify_emails: [],
  };

  // 추가: scanConfig state
  const [scanConfig, setScanConfig] = useState({ ...defaultScanConfig });
  const [scanSubmitting, setScanSubmitting] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Dummy vulnerability data for Summary tab
  const getDummyVulnerabilities = () => [
    {
      vulnerability_title: "IDOR: Missing authorization allows arbitrary project membership updates",
      severity: "High",
      cwe: "CWE-639",
      location: { file_path: "web/src/ee/features/admin-api/server/projects/projectById/memberships/index.ts", line_number: "53-116" },
      description: "The handler handleUpdateMembership validates the shape of req.body but does not verify the caller's authorization...",
      taint_flow_analysis: {
        source: { file_path: "web/src/ee/features/admin-api/server/projects/projectById/memberships/index.ts", line_number: "59", explanation: "Untrusted request body is accepted...", code_snippet: "const validatedBody = MembershipSchema.safeParse(req.body);" },
        propagation: { file_path: "web/src/ee/features/admin-api/server/projects/projectById/memberships/index.ts", line_number: "69-74", explanation: "The untrusted userId from the request is used...", code_snippet: "const orgMembership = await prisma.organizationMembership.findUnique({ ... });" },
        sink: { file_path: "web/src/ee/features/admin-api/server/projects/projectById/memberships/index.ts", line_number: "92-108", explanation: "The code upserts project membership...", code_snippet: "const membership = await prisma.projectMembership.upsert({ ... });" }
      },
      proof_of_concept: { scenario: "An authenticated but low-privileged organization member can arbitrarily update another user's project role...", example: "PUT /api/public/projects/12345/memberships\n..." },
      recommendation: { how_to_fix: "Add a strict authorization check ensuring the authenticated requester has the privilege...", code_example_fix: "export async function handleUpdateMembership(...) { ... }" }
    }
  ];

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const closeTriggerModal = () => {
    setShowScanModal(false);
    setScanMessage('');
    setError('');
    setScanConfig({ ...defaultScanConfig });
    setCurrentScanId(null);
    setScanSubmitting(false);
    setScanStatus('idle');
  };

  const handleTriggerScan = async (e) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    setScanMessage('');
    setError('');

    const repoUrl = (scanConfig.github_url || '').trim();
    if (!repoUrl) {
      const message = 'GitHub URL을 입력해주세요';
      setScanMessage(message);
      setError(message);
      return;
    }

    const mode = scanConfig.mode;
    const isCustom = mode === 'custom';
    const provider = (
      isCustom ? scanConfig.custom_provider :
        scanConfig.preset_provider || ''
    ).trim();
    const model = (
      isCustom ? scanConfig.custom_model :
        scanConfig.preset_model || ''
    ).trim();

    if (!provider || !model) {
      const message = '사용할 Provider와 모델을 선택하거나 입력해주세요';
      setScanMessage(message);
      setError(message);
      return;
    }

    const notifyEnabled = Boolean(scanConfig.notify_enabled);
    const notifyEmails = Array.isArray(scanConfig.notify_emails) ? scanConfig.notify_emails : [];
    const trimmedEmails = notifyEmails.map((email) => (email || '').trim()).filter(Boolean);
    if (notifyEnabled) {
      if (!trimmedEmails.length) {
        const message = '이메일 알림을 켜면 주소를 하나 이상 입력해주세요';
        setScanMessage(message);
        setError(message);
        return;
      }
      const invalidEmail = trimmedEmails.find((email) => !emailRegex.test(email));
      if (invalidEmail) {
        const message = `이메일 주소를 확인해주세요: ${invalidEmail}`;
        setScanMessage(message);
        setError(message);
        return;
      }
    }

    const payload = {
      github_url: repoUrl,
      discovery_mode: scanConfig.discovery_mode,
      verifier_mode: scanConfig.verifier_mode,
      scan_type: scanConfig.scan_type,
      api_provider: provider,
      model,
      run_sast: scanConfig.run_sast,
      profile_mode: mode,
      preset_advanced: scanConfig.preset_advanced,
      custom_advanced: scanConfig.custom_advanced,
    };
    if (notifyEnabled) {
      payload.notify_emails = trimmedEmails;
    }

    // LLM endpoint/API key 전달 (백엔드 → Jenkins)
    let endpoint = '';
    let apiKey = '';
    if (isCustom) {
      endpoint = (scanConfig.custom_endpoint || '').trim();
      apiKey = (scanConfig.custom_api_key || '').trim();
      const customConfig = {
        endpoint,
        api_key: apiKey,
        headers: (scanConfig.custom_headers || '').trim(),
      };
      const filteredConfig = Object.fromEntries(
        Object.entries(customConfig).filter(([, value]) => value)
      );
      if (Object.keys(filteredConfig).length > 0) {
        payload.custom_config = filteredConfig;
      }
    } else if (scanConfig.preset_advanced) {
      endpoint = (scanConfig.preset_endpoint || '').trim();
      apiKey = (scanConfig.preset_api_key || '').trim();
      const presetConfig = {
        endpoint,
        api_key: apiKey,
        headers: (scanConfig.preset_headers || '').trim(),
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
      const triggeredId = res?.id ?? null;
      if (triggeredId) {
        setCurrentScanId(triggeredId);
      }
      setScanMessage(`스캔이 시작되었습니다 (id: ${res?.id ?? '-'}, status: ${res?.status ?? 'unknown'})`);

      const list = await scanService.getScans(id);
      setScans(list || []);

      setTimeout(() => {
        closeTriggerModal();
      }, 2000);
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : (err?.response?.data?.detail || '스캔 시작에 실패했습니다');
      setScanMessage(message);
      setError(message);
      setScanStatus('failed');
      setCurrentScanId(null);
    } finally {
      setScanSubmitting(false);
    }
  };

  const handleScanConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setScanConfig((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const openTriggerModal = () => {
    setScanConfig({ ...defaultScanConfig });
    setScanMessage('');
    setError('');
    setCurrentScanId(null);
    setScanStatus('idle');
    setScanSubmitting(false);
    setShowScanModal(true);
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
        try {
          const projectData = await projectService.getProject(id);
          if (projectData) {
            setProject(projectData);
            setProjectName(projectData.name);
          }
        } catch (projectError) {
          console.error('Failed to load project metadata:', projectError);
        }

        const list = await scanService.getScans(id);
        const normalizedList = (list || []).map(normalizeScanSummary);
        setScans(normalizedList);

        if (!projectName && normalizedList.length > 0) {
          const firstScan = normalizedList[0];
          const derivedName =
            firstScan?.project_name ||
            firstScan?.scan_results?.project ||
            firstScan?.scan_results?.project_name;
          if (derivedName) {
            setProjectName(derivedName);
          }
        }
      } catch (e) {
        setError(typeof e === 'string' ? e : (e?.response?.data?.detail || '스캔 목록을 불러오지 못했습니다.'));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, navigate]);

  const openDetail = async (scanId) => {
    try {
      setError('');
      const detail = await scanService.getScan(id, scanId);
      const normalizedDetail = normalizeScanSummary(detail);
      setSelected(normalizedDetail);
      setShowDetail(true);
      if (!projectName) {
        const derived =
          normalizedDetail?.project_name ||
          normalizedDetail?.scan_results?.project ||
          normalizedDetail?.scan_results?.project_name;
        if (derived) {
          setProjectName(derived);
        }
      }
    } catch (e) {
      setError(typeof e === 'string' ? e : (e?.response?.data?.detail || '스캔 상세 정보를 불러오지 못했습니다.'));
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      running: 'bg-blue-50 text-blue-700 border-blue-200',
      failed: 'bg-rose-50 text-rose-700 border-rose-200',
      pending: 'bg-gray-50 text-gray-700 border-gray-200'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
        projectName={projectName || '프로젝트'}
        user={user}
        handleLogout={handleLogout}
        triggerMode={project?.trigger_mode}
      />

      {/* Main Content */}
      <main className="pt-36 px-8 pb-10">
        <div className="max-w-[1400px] mx-auto">
          {/* Hero Header */}
          <ScansHero
            isDark={isDark}
            viewMode={viewMode}
            setViewMode={setViewMode}
            projectId={id}
            onNewScan={openTriggerModal}
          />

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-sm">{error}</div>
          )}

          {/* Loading */}
          {loading && (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={viewMode === 'grid' ? `h-48 ${isDark ? 'bg-gray-800/50 border-gray-700/60' : 'bg-white/70 border-white/60'} rounded-2xl border animate-pulse` : `h-24 ${isDark ? 'bg-gray-800/50 border-gray-700/60' : 'bg-white/70 border-white/60'} rounded-xl border animate-pulse`} />
              ))}
            </div>
          )}

          {/* Scans Grid View */}
          {!loading && scans.length === 0 && (
            <div className="mt-12 text-center py-12">
              <svg className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className={`mt-4 text-sm ${mutedText(isDark)}`}>필터 조건에 맞는 취약점이 없습니다</p>
            </div>
          )}

          {!loading && viewMode === 'grid' && scans.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scans.map((scan) => (
                <ScanGridCard
                  key={scan.id}
                  scan={scan}
                  isDark={isDark}
                  statusBadgeClasses={statusBadgeClasses}
                  formatDate={formatDate}
                  onOpenDetail={() => openDetail(scan.id)}
                />
              ))}
            </div>
          )}

          {/* Scans List View */}
          {!loading && viewMode === 'list' && scans.length > 0 && (
            <div className="space-y-4">
              {scans.map((scan) => (
                <ScanListItem
                  key={scan.id}
                  scan={scan}
                  isDark={isDark}
                  statusBadgeClasses={statusBadgeClasses}
                  formatDate={formatDate}
                  onOpenDetail={() => openDetail(scan.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {showDetail && selected && (
        <ScanDetailModal
          selected={selected}
          onClose={() => setShowDetail(false)}
          isDark={isDark}
          projectId={id}
          projectName={projectName}
        />
      )}

      {showScanModal && (
        <ProjectScanModal
          scanForm={scanConfig}
          scanMessage={scanMessage}
          scanSubmitting={scanSubmitting}
          scanStatus={scanStatus}
          onClose={closeTriggerModal}
          onChange={handleScanConfigChange}
          onSubmit={handleTriggerScan}
          isDark={isDark}
          projectId={id}
          scanId={currentScanId}
          onPipelineFinished={(status) => setScanStatus(status)}
        />
      )}
    </div>
  );
}

export default Scans;
