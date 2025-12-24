import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';
import projectService from '../services/projectService';
import AppNavbar from '../components/common/AppNavbar';
import { useTheme } from '../hooks/useTheme';

const providerCatalog = [
  {
    value: 'openrouter',
    label: 'OpenRouter',
    models: [
      { value: 'x-ai/grok-4.1-fast', label: 'xAI: Grok 4.1 Fast' },
      { value: 'qwen/qwen3-vl-30b-a3b-instruct', label: 'Qwen: Qwen3 VL 30B A3B Instruct' },
      { value: 'qwen/qwen3-vl-235b-a22b-instruct', label: 'Qwen: Qwen3 VL 235B A22B Instruct' },
      { value: 'z-ai/glm-4.6', label: 'Z.AI: GLM 4.6' },
      { value: 'google/gemini-2.0-flash-001', label: 'Google: Gemini 2.0 Flash 001' },
      { value: 'google/gemini-2.0-pro-exp-02-05', label: 'Google: Gemini 2.0 Pro Exp 02-05' },
      { value: 'deepseek/deepseek-r1', label: 'DeepSeek: DeepSeek R1' },
      { value: 'deepseek/deepseek-r1-distill-llama-70b', label: 'DeepSeek: DeepSeek R1 Distill Llama 70B' },
      { value: 'openai/gpt-4o-2024-11-20', label: 'OpenAI: GPT-4o 2024-11-20' },
      { value: 'openai/o3-mini-high', label: 'OpenAI: o3 Mini High' },
    ],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: [
      { value: 'gpt-5.1', label: 'GPT-5.1' },
      { value: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' },
      { value: 'gpt-5', label: 'GPT-5' },
      { value: 'gpt-5-codex', label: 'GPT-5 Codex' },
      { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
      { value: 'gpt-5-nano', label: 'GPT-5 Nano' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4', label: 'GPT-4' },
    ],
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: [
      { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude 4.5 Haiku' },
    ],
  },
  {
    value: 'google',
    label: 'Google (Vertex AI)',
    models: [
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
      { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    ],
  },
  {
    value: 'bedrock',
    label: 'AWS Bedrock',
    models: [
      { value: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude 4.5 Sonnet' },
      { value: 'global.anthropic.claude-haiku-4-5-20250929-v1:0', label: 'Claude 4.5 Haiku' },
      { value: 'global.amazon.nova-2-lite-v1:0', label: 'Nova 2 Lite' },
    ],
  },
  {
    value: 'groq',
    label: 'Groq',
    models: [
      { value: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
      { value: 'qwen/qwen3-14b', label: 'Qwen 3 14B' },
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
      { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32K' },
    ],
  },
];

function Home() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [view, setView] = useState('grid'); // 'grid' or 'list'
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'vulnerabilities'
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [stats, setStats] = useState({
    total_projects: 0,
    active_projects: 0,
    total_scans: 0,
    total_vulnerabilities: 0
  });
  const [loading, setLoading] = useState(true);
  const getInitialCreateForm = () => ({
    name: '',
    description: '',
    team_id: '',
    trigger_mode: 'web',
    git_url: '',
    git_branch: '',
    webhook_secret: '',
    default_scan_mode: 'custom',  // Full Scan (기본값)
    default_profile_mode: 'preset',  // 기본 설정 (기본값)
    default_provider: 'openrouter',
    default_model: 'x-ai/grok-4.1-fast'
  });
  const [createFormData, setCreateFormData] = useState(getInitialCreateForm);
  const [myTeams, setMyTeams] = useState([]);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    show: false,
    projectId: null,
    projectName: ''
  });

  useEffect(() => {
    const init = async () => {
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }

      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      // Load projects, stats, and teams
      await loadProjects();
      await loadStats();
      await loadMyTeams();
    };

    init();
  }, [navigate]);

  // Filter and sort projects
  useEffect(() => {
    let filtered = [...projects];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Sort
    if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'vulnerabilities') {
      filtered.sort((a, b) => (b.total_vulnerabilities || 0) - (a.total_vulnerabilities || 0));
    }

    setFilteredProjects(filtered);
  }, [projects, statusFilter, searchQuery, sortBy]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
      setShowSortMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await projectService.getProjectStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadMyTeams = async () => {
    try {
      const response = await projectService.getMyTeams();
      setMyTeams(response);
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError('');

    if (!createFormData.name.trim()) {
      setError('Project name is required');
      return;
    }

    const trimmedName = createFormData.name.trim();
    if (!trimmedName) {
      setError('Project name is required');
      return;
    }

    if (createFormData.trigger_mode === 'git') {
      if (!createFormData.git_url.trim() || !createFormData.git_branch.trim()) {
        setError('Git URL과 브랜치는 Git 트리거 모드에서 필수입니다.');
        return;
      }
    }

    try {
      const dataToSend = {
        name: trimmedName,
        description: createFormData.description?.trim() || '',
        team_id: createFormData.team_id ? parseInt(createFormData.team_id, 10) : null,
        trigger_mode: createFormData.trigger_mode || 'web',
        git_url: createFormData.git_url?.trim() || undefined,
        git_branch: createFormData.git_branch?.trim() || undefined,
        webhook_secret: createFormData.webhook_secret?.trim() || undefined,
        default_scan_mode: createFormData.default_scan_mode || 'custom',
        default_profile_mode: createFormData.default_profile_mode || 'preset',
        default_provider: createFormData.default_provider || 'groq',
        default_model: createFormData.default_model || 'llama3-70b-8192',
      };
      await projectService.createProject(dataToSend);
      setShowCreateModal(false);
      setCreateFormData(getInitialCreateForm());
      await loadProjects();
      await loadStats();
    } catch (err) {
      setError(err.toString());
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setCreateFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTriggerModeChange = (mode) => {
    if (mode === createFormData.trigger_mode) return;
    setCreateFormData((prev) => ({
      ...prev,
      trigger_mode: mode,
      ...(mode === 'web'
        ? { git_url: '', git_branch: '', webhook_secret: '' }
        : {}),
    }));
  };

  const showDeleteConfirm = (projectId, projectName) => {
    setDeleteConfirmModal({
      show: true,
      projectId,
      projectName
    });
    setOpenMenuId(null);
  };

  const handleDeleteProject = async () => {
    try {
      await projectService.deleteProject(deleteConfirmModal.projectId);
      setDeleteConfirmModal({ show: false, projectId: null, projectName: '' });
      await loadProjects();
      await loadStats();
    } catch (err) {
      alert('프로젝트 삭제 실패: ' + err.message);
      console.error('Failed to delete project:', err);
    }
  };

  const toggleMenu = (e, projectId) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === projectId ? null : projectId);
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getScoreBg = (score) => {
    if (score >= 90) return 'bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'bg-amber-50 border-amber-200';
    return 'bg-rose-50 border-rose-200';
  };

  const calculateScore = (project) => {
    if (project.total_scans === 0) return 100;
    const vulnerabilityFactor = project.total_vulnerabilities / project.total_scans;
    return Math.max(0, Math.min(100, Math.round(100 - vulnerabilityFactor * 20)));
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800' : 'bg-[#EAF2FF]'}`}>
      {isDark ? (
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 -left-10 w-[28rem] h-[28rem] bg-cyan-600/20 rounded-full blur-3xl animate-blob"></div>
          <div className="absolute top-10 -right-16 w-[26rem] h-[26rem] bg-blue-700/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-4rem] left-16 w-[30rem] h-[30rem] bg-purple-700/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      ) : (
        <div className="fixed inset-0 -z-10 bg-[#EAF2FF]" />
      )}

      <AppNavbar
        user={user}
        handleLogout={handleLogout}
        breadcrumb={{
          items: [
            { label: '프로젝트' }
          ]
        }}
      />


      {/* Main Content */}
      <main className="relative pt-24 pb-12 px-6">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className={`text-4xl font-bold ${isDark ? 'bg-gradient-to-r from-gray-100 via-cyan-200 to-blue-200 bg-clip-text text-transparent' : 'bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent'} mb-2`}>
                  프로젝트
                </h1>
                <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>보안 진단 및 취약점 스캔 관리</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex items-center space-x-2"
                style={{ backgroundColor: '#00326A', boxShadow: '0 10px 15px -3px rgba(0, 50, 106, 0.3)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#002355';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 50, 106, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#00326A';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 50, 106, 0.3)';
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>새 프로젝트</span>
              </button>
            </div>
          </div>

          {/* Stats Bar - Unified Design */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            <div className={`${isDark ? 'bg-gray-800/60 border border-gray-600 shadow-gray-900/25' : 'bg-white border border-indigo-200 shadow-[0_18px_35px_rgba(79,70,229,0.08)]'} rounded-2xl p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider font-semibold mb-2`}>전체 프로젝트</p>
                  <p className={`text-4xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-1`}>{stats.total_projects}</p>
                  <p className="text-xs text-gray-500">전체 기간</p>
                </div>
                <div className={`w-12 h-12 ${isDark ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'} rounded-xl flex items-center justify-center`}>
                  <svg className={`w-6 h-6 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className={`${isDark ? 'bg-gray-800/60 border border-gray-600 shadow-gray-900/25' : 'bg-white border border-emerald-200 shadow-[0_18px_35px_rgba(16,185,129,0.12)]'} rounded-2xl p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider font-semibold mb-2`}>활성 프로젝트</p>
                  <p className={`text-4xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-1`}>{stats.active_projects}</p>
                  <p className="text-xs text-emerald-600 font-medium">● 실행 중</p>
                </div>
                <div className={`w-12 h-12 ${isDark ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'} border rounded-xl flex items-center justify-center`}>
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className={`${isDark ? 'bg-gray-800/60 border border-gray-600 shadow-gray-900/25' : 'bg-white border border-amber-200 shadow-[0_18px_35px_rgba(251,191,36,0.13)]'} rounded-2xl p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider font-semibold mb-2`}>전체 이슈</p>
                  <p className={`text-4xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-1`}>{stats.total_vulnerabilities}</p>
                  <p className="text-xs text-amber-600 font-medium">주의 필요</p>
                </div>
                <div className={`w-12 h-12 ${isDark ? 'bg-amber-500/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'} border rounded-xl flex items-center justify-center`}>
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className={`${isDark ? 'bg-gray-800/60 border border-gray-600 shadow-gray-900/25' : 'bg-white border border-blue-200 shadow-[0_18px_35px_rgba(59,130,246,0.12)]'} rounded-2xl p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider font-semibold mb-2`}>전체 스캔</p>
                  <p className={`text-4xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-1`}>{stats.total_scans}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>완료됨</p>
                </div>
                <div className={`w-12 h-12 ${isDark ? 'bg-blue-500/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border rounded-xl flex items-center justify-center`}>
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Controls */}
          <div className="flex items-center justify-between mb-6 gap-4">
            {/* Search Bar - Left */}
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="프로젝트 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 ${isDark ? 'bg-gray-800/90 border-gray-700 text-white placeholder-gray-500' : 'bg-white/90 border-gray-200/50 text-gray-900'} backdrop-blur-sm border rounded-xl focus:outline-none focus:ring-2 ${isDark ? 'focus:ring-cyan-500' : 'focus:ring-indigo-500'} focus:border-transparent transition-all duration-300 shadow-sm hover:shadow-md`}
              />
              <svg className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center space-x-3">
              {/* Sort Menu - Custom Design */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSortMenu(!showSortMenu);
                  }}
                  className={`flex items-center space-x-2 px-4 py-2.5 ${isDark ? 'bg-gray-800/90 border-gray-700 text-gray-300' : 'bg-white/90 border-gray-200/50 text-gray-700'} backdrop-blur-sm border rounded-xl text-sm font-medium ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50 hover:border-gray-300'} focus:outline-none transition-all duration-300 shadow-sm hover:shadow-md`}
                >
                  <svg className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  <span>{sortBy === 'recent' ? '최신순' : sortBy === 'name' ? '이름순' : '취약점순'}</span>
                  <svg className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'} transition-transform ${showSortMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Sort Dropdown Menu */}
                {showSortMenu && (
                  <div className={`absolute right-0 mt-2 w-48 ${isDark ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-gray-200/50'} backdrop-blur-xl rounded-xl shadow-2xl border py-2 z-50 animate-fade-in`}>
                    <button
                      onClick={() => {
                        setSortBy('recent');
                        setShowSortMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 transition-colors ${sortBy === 'recent'
                        ? isDark ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 font-semibold'
                        : isDark ? 'text-gray-300 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>최신순</span>
                      {sortBy === 'recent' && (
                        <svg className="w-4 h-4 ml-auto text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSortBy('name');
                        setShowSortMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 transition-colors ${sortBy === 'name'
                        ? isDark ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 font-semibold'
                        : isDark ? 'text-gray-300 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                      </svg>
                      <span>이름순</span>
                      {sortBy === 'name' && (
                        <svg className="w-4 h-4 ml-auto text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSortBy('vulnerabilities');
                        setShowSortMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 transition-colors ${sortBy === 'vulnerabilities'
                        ? isDark ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 font-semibold'
                        : isDark ? 'text-gray-300 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>취약점순</span>
                      {sortBy === 'vulnerabilities' && (
                        <svg className="w-4 h-4 ml-auto text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className={`h-8 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

              {/* Filter Buttons */}
              <div className={`flex items-center space-x-1.5 ${isDark ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-200/50'} backdrop-blur-sm border rounded-xl p-1 shadow-sm`}>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-300 ${statusFilter === 'all'
                    ? isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 border border-transparent' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                    }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-300 ${statusFilter === 'active'
                    ? isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 border border-transparent' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                    }`}
                >
                  활성
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-300 ${statusFilter === 'inactive'
                    ? isDark ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : 'bg-gray-50 text-gray-700 border border-gray-200'
                    : isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 border border-transparent' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                    }`}
                >
                  비활성
                </button>
              </div>

              {/* Divider */}
              <div className={`h-8 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

              {/* View Toggle */}
              <div className={`flex items-center space-x-1 ${isDark ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-200/50'} backdrop-blur-sm border rounded-xl p-1 shadow-sm`}>
                <button
                  onClick={() => setView('grid')}
                  className={`p-2 rounded-lg transition-all duration-300 ${view === 'grid'
                    ? isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-indigo-50 text-indigo-600'
                    : isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  title="그리드 보기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2 rounded-lg transition-all duration-300 ${view === 'list'
                    ? isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-indigo-50 text-indigo-600'
                    : isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  title="리스트 보기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Results Info */}
          {!loading && filteredProjects.length > 0 && (
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center space-x-3">
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{filteredProjects.length}</span>개 프로젝트 표시 중{' '}
                  (전체 <span className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{projects.length}</span>개)
                </p>
                {(searchQuery || statusFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                    className={`text-xs font-medium flex items-center space-x-1 hover:underline ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>모든 필터 초기화</span>
                  </button>
                )}
              </div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                정렬 기준: <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {sortBy === 'recent' ? '최신순' : sortBy === 'name' ? '이름순' : '취약점순'}
                </span>
              </div>
            </div>
          )}

          {/* Projects Table/Grid */}
          {view === 'list' ? (
            <div className={`${isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg overflow-hidden`}>
              <table className="w-full">
                <thead className={`${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>프로젝트</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>상태</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>마지막 스캔</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>이슈</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>점수</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>작업</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      className={`${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 ${isDark ? 'bg-gray-700 border border-gray-600' : 'bg-gray-100'} rounded-lg flex items-center justify-center mr-3`}>
                            <svg className={`w-4 h-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          <span className={`text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{project.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${project.status === 'active'
                          ? isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isDark ? 'bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                          <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${project.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                          {project.status}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatTimeAgo(project.last_scan_at)}</td>
                      <td className="px-6 py-4">
                        {project.total_vulnerabilities > 0 ? (
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{project.total_vulnerabilities}</span>
                          </div>
                        ) : (
                          <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-semibold ${getScoreColor(calculateScore(project))}`}>
                            {calculateScore(project)}
                          </span>
                          <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <div
                              className={`h-full ${calculateScore(project) >= 90 ? 'bg-emerald-500' : calculateScore(project) >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${calculateScore(project)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredProjects.length === 0 && !loading ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative mb-8">
                <div className={`absolute inset-0 blur-3xl ${isDark ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15' : 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20'}`}></div>
                <div className={`relative w-32 h-32 rounded-3xl flex items-center justify-center border ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-gray-700' : 'bg-gradient-to-br from-indigo-100 to-purple-100 border-indigo-100'}`}>
                  <svg className={`w-16 h-16 ${isDark ? 'text-cyan-300' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {searchQuery ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    )}
                  </svg>
                </div>
              </div>

              <h3 className={`text-2xl font-bold mb-3 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                {searchQuery ? '프로젝트를 찾을 수 없습니다' : '아직 프로젝트가 없습니다'}
              </h3>

              <p className={`mb-8 text-center max-w-md ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {searchQuery
                  ? `"${searchQuery}"와 일치하는 프로젝트가 없습니다. 검색어나 필터를 조정해 보세요.`
                  : '첫 번째 보안 진단 프로젝트를 생성하여 시작하세요.'
                }
              </p>

              {searchQuery ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSearchQuery('')}
                    className={`px-5 py-2.5 font-medium rounded-lg transition-all duration-300 border ${isDark ? 'bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700/80' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    검색 초기화
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300 flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>프로젝트 생성</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className={`px-6 py-3 text-white font-semibold rounded-xl hover:-translate-y-0.5 transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-xl ${isDark ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/30 hover:shadow-cyan-500/40' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/30 hover:shadow-indigo-500/40'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>첫 번째 프로젝트 만들기</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className={`relative ${isDark ? 'bg-gray-800/70 border border-gray-600 shadow-gray-900/40' : 'bg-white border border-indigo-200 shadow-[0_25px_50px_rgba(79,70,229,0.10)]'} backdrop-blur-sm rounded-2xl p-6 ${isDark ? 'hover:shadow-2xl hover:shadow-cyan-500/20 hover:border-gray-500' : 'hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-300'} hover:-translate-y-2 transition-all duration-500 cursor-pointer group before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br ${isDark ? 'before:from-cyan-500/0 before:to-blue-500/0 hover:before:from-cyan-500/5 hover:before:to-blue-500/5' : 'before:from-indigo-500/0 before:to-purple-500/0 hover:before:from-indigo-500/5 hover:before:to-purple-500/5'} before:transition-all before:duration-500`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 ${isDark ? 'bg-gray-700 border border-gray-600' : 'bg-gray-100'} rounded-lg flex items-center justify-center`}>
                        <svg className={`w-4 h-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${project.status === 'active'
                        ? isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isDark ? 'bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${project.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                        {project.status}
                      </span>
                    </div>
                    {/* 메뉴 버튼 - Superuser 또는 프로젝트 소유자만 표시 */}
                    {(user?.is_superuser || project.user_id === user?.id) && (
                      <div className="relative">
                        <button
                          onClick={(e) => toggleMenu(e, project.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
                          title="메뉴"
                        >
                          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>

                        {/* 드롭다운 메뉴 */}
                        {openMenuId === project.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 animate-fade-in">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                showDeleteConfirm(project.id, project.name);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>프로젝트 삭제</span>
                            </button>
                            {/* 향후 다른 메뉴 추가 가능 */}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100 group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-blue-400' : 'text-gray-900 group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-purple-600'} mb-2 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300 relative z-10 line-clamp-1`}>
                    {project.name}
                  </h3>

                  {/* Description */}
                  {project.description && (
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-4 line-clamp-2 relative z-10`}>
                      {project.description}
                    </p>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                    <div className={`${isDark ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20' : 'bg-gradient-to-br from-blue-50 to-indigo-50'} rounded-lg p-3`}>
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>전체 스캔</div>
                      <div className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent'}`}>
                        {project.total_scans}
                      </div>
                    </div>
                    <div className={`${isDark ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20' : 'bg-gradient-to-br from-amber-50 to-orange-50'} rounded-lg p-3`}>
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>이슈</div>
                      <div className={`text-2xl font-bold ${isDark ? 'text-amber-400' : 'bg-gradient-to-br from-amber-600 to-orange-600 bg-clip-text text-transparent'}`}>
                        {project.total_vulnerabilities}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className={`pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'} relative z-10`}>
                    <div className={`flex items-center justify-between text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div className="flex items-center space-x-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatTimeAgo(project.last_scan_at)}</span>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}

              {/* New Project Card - Clean */}
              <button
                onClick={() => setShowCreateModal(true)}
                className={`relative group ${isDark ? 'bg-gray-800/50 border-2 border-dashed border-gray-600 hover:border-cyan-500' : 'bg-white border-2 border-dashed border-blue-300 hover:border-blue-400'} rounded-2xl p-6 flex flex-col items-center justify-center min-h-[320px] text-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1`}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-20 h-20 ${isDark ? 'bg-cyan-500/20 border-cyan-500/30' : 'bg-indigo-50 border-indigo-100'} border rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 ${isDark ? 'group-hover:bg-cyan-500/30 group-hover:border-cyan-500/40' : 'group-hover:bg-indigo-100 group-hover:border-indigo-200'}`}>
                    <svg className={`w-10 h-10 ${isDark ? 'text-cyan-400' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>

                  <p className={`text-lg font-bold ${isDark ? 'text-gray-100 group-hover:text-cyan-400' : 'text-gray-900 group-hover:text-indigo-600'} mb-2 transition-colors`}>
                    새 프로젝트 만들기
                  </p>

                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-6`}>
                    새로운 보안 진단 시작하기
                  </p>

                  <div className={`flex items-center justify-center space-x-2 text-xs ${isDark ? 'text-cyan-400' : 'text-indigo-600'} font-medium`}>
                    <span>클릭하여 시작</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/60 backdrop-blur-md">
          <div
            className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl ${isDark ? 'bg-gray-900 text-gray-100 border-2 border-gray-800' : 'bg-white text-gray-900 border-2 border-blue-100'
              }`}
          >
            <div
              className={`flex items-start justify-between px-8 py-6 border-b ${isDark
                ? 'bg-gradient-to-r from-slate-950 via-gray-900 to-slate-900 border-gray-800'
                : 'bg-gradient-to-r from-blue-50 via-white to-purple-50 border-blue-100'
                }`}
            >
              <div>
                <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400">NEW PROJECT</p>
                <h3 className="text-3xl font-bold mt-2">스캔 파이프라인 구성</h3>
                <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  새 스캔 모달과 동일한 인터랙션으로 프로젝트를 만들고 트리거 모드를 선택하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                  setCreateFormData(getInitialCreateForm());
                }}
                className={`rounded-full p-2 transition ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="px-8 py-6 space-y-6">
              {error && (
                <div
                  className={`p-4 rounded-2xl border-[3px] ${isDark
                    ? 'bg-rose-500/10 border-rose-400/60 text-rose-200'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                >
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider">
                    프로젝트 이름
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={createFormData.name}
                    onChange={handleFormChange}
                    placeholder="예: Zero Trust API Security"
                    required
                    className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] ${isDark
                      ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                      : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                      }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider">
                    팀 (선택)
                  </label>
                  <select
                    name="team_id"
                    value={createFormData.team_id}
                    onChange={handleFormChange}
                    className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] ${isDark
                      ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                      : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                      }`}
                  >
                    <option value="">팀 없음</option>
                    {myTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} {team.is_manager && '(매니저)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider">
                  설명
                </label>
                <textarea
                  name="description"
                  value={createFormData.description}
                  onChange={handleFormChange}
                  placeholder="진단 범위, 아키텍처, 보안 목표 등을 입력하세요."
                  rows="3"
                  className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] resize-none ${isDark
                    ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                    : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                    }`}
                ></textarea>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider">
                    트리거 모드
                  </label>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Web 또는 Git 이벤트 중 하나를 선택
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    {
                      value: 'web',
                      label: 'Web Trigger',
                      badge: 'Manual',
                      description: '대시보드에서 즉시 스캔 실행 및 모니터링',
                    },
                    {
                      value: 'git',
                      label: 'Git Event',
                      badge: 'Auto',
                      description: '커밋/PR 발생 시 Jenkins 파이프라인 자동 실행',
                    },
                  ].map((option) => {
                    const isActive = createFormData.trigger_mode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleTriggerModeChange(option.value)}
                        className={`text-left rounded-2xl border-[3px] p-4 transition-all ${isActive
                          ? isDark
                            ? 'border-blue-400 bg-slate-900/80 shadow-inner shadow-blue-500/20'
                            : 'border-blue-500 bg-blue-50 shadow-inner shadow-blue-500/10'
                          : isDark
                            ? 'border-gray-700 bg-gray-900/40 hover:border-blue-400/70'
                            : 'border-blue-100 bg-white hover:border-blue-400/60'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-base font-semibold">{option.label}</div>
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-full ${isActive
                              ? isDark
                                ? 'bg-blue-500/30 text-blue-100 border border-blue-400/40'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                              : isDark
                                ? 'bg-gray-800 text-gray-300 border border-gray-700'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}
                          >
                            {option.badge}
                          </span>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {createFormData.trigger_mode === 'git' && (
                <div className="space-y-4">
                  <div className={`rounded-2xl p-5 border-[3px] ${isDark ? 'border-gray-700 bg-gray-900/40' : 'border-blue-100 bg-blue-50/40'}`}>
                    <p className="text-sm font-semibold mb-3">Git Repository 설정</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider">
                          Repository URL
                        </label>
                        <input
                          type="url"
                          name="git_url"
                          value={createFormData.git_url}
                          onChange={handleFormChange}
                          placeholder="https://github.com/org/repo.git"
                          className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] ${isDark
                            ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                            : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                            }`}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider">
                          Branch
                        </label>
                        <input
                          type="text"
                          name="git_branch"
                          value={createFormData.git_branch}
                          onChange={handleFormChange}
                          placeholder="main"
                          className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] ${isDark
                            ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                            : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                            }`}
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                          Webhook Secret
                          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>선택 사항</span>
                        </label>
                        <input
                          type="text"
                          name="webhook_secret"
                          value={createFormData.webhook_secret}
                          onChange={handleFormChange}
                          placeholder="GitHub Secret"
                          className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] ${isDark
                            ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                            : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                            }`}
                        />
                      </div>
                    </div>
                    <div className={`mt-4 text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <p className="font-semibold text-sm">자동 구성 항목</p>
                      <p>• Jenkins Pipeline provisioning</p>
                      <p>• GitHub Webhook 엔드포인트 및 Secret 전달</p>
                      <p>• 커밋/PR 이벤트 시 자동 스캔</p>
                    </div>
                  </div>

                  {/* 기본 스캔 모드 설정 */}
                  <div className={`rounded-2xl p-5 border-[3px] ${isDark ? 'border-gray-700 bg-gray-900/40' : 'border-blue-100 bg-blue-50/40'}`}>
                    <p className="text-sm font-semibold mb-3">자동 스캔 기본 설정</p>
                    <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Git push 이벤트 발생 시 사용할 기본 스캔 모드를 선택하세요.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider">
                          스캔 모드
                        </label>
                        <select
                          name="default_scan_mode"
                          value={createFormData.default_scan_mode}
                          onChange={handleFormChange}
                          className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] ${isDark
                            ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                            : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                            }`}
                        >
                          <option value="preset">⚡ Quick Scan (빠른 스캔)</option>
                          <option value="custom">🔍 Full Scan (전체 스캔, 권장)</option>
                        </select>
                        <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          {createFormData.default_scan_mode === 'preset' && '빠른 스캔 - 기본 취약점 탐지'}
                          {createFormData.default_scan_mode === 'custom' && '전체 스캔 - 상세한 분석 (권장)'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider">
                          프로필 모드
                        </label>
                        <select
                          name="default_profile_mode"
                          value={createFormData.default_profile_mode}
                          onChange={handleFormChange}
                          className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] ${isDark
                            ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                            : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                            }`}
                        >
                          <option value="preset">⚙️ 기본 설정 (권장)</option>
                          <option value="custom">🔧 고급 설정</option>
                        </select>
                        <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          {createFormData.default_profile_mode === 'preset' && '기본 설정 - 일반적인 사용 (권장)'}
                          {createFormData.default_profile_mode === 'custom' && '고급 설정 - 세부 조정'}
                        </p>
                      </div>

                      {/* AI 모델 설정 */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider">
                          AI Provider
                        </label>
                        <select
                          name="default_provider"
                          value={createFormData.default_provider}
                          onChange={(e) => {
                            const newProvider = e.target.value;
                            // Find default model for this provider (first one)
                            const providerData = providerCatalog.find(p => p.value === newProvider);
                            const defaultModel = providerData?.models[0]?.value || '';

                            setCreateFormData(prev => ({
                              ...prev,
                              default_provider: newProvider,
                              default_model: defaultModel
                            }));
                          }}
                          className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] ${isDark
                            ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                            : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                            }`}
                        >
                          {providerCatalog.map(provider => (
                            <option key={provider.value} value={provider.value}>
                              {provider.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider">
                          AI Model
                        </label>
                        <select
                          name="default_model"
                          value={createFormData.default_model}
                          onChange={handleFormChange}
                          className={`mt-2 w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 border-[3px] ${isDark
                            ? 'bg-gray-900/70 border-gray-700 text-white focus:ring-blue-400 focus:border-blue-400'
                            : 'bg-white border-blue-100 text-gray-900 focus:ring-blue-900 focus:border-blue-600'
                            }`}
                        >
                          {providerCatalog
                            .find(p => p.value === createFormData.default_provider)
                            ?.models.map(model => (
                              <option key={model.value} value={model.value}>
                                {model.label}
                              </option>
                            )) || <option value="">모델 없음</option>}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {createFormData.trigger_mode === 'web' && (
                <div className={`rounded-2xl border-[3px] p-5 ${isDark ? 'border-gray-700 bg-gray-900/40' : 'border-blue-100 bg-blue-50/40'}`}>
                  <p className="text-sm font-semibold mb-2">Web Trigger</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    대시보드에서 새 스캔 모달을 열어 즉시 파이프라인을 실행할 수 있습니다. Jenkins 진행 상황,
                    Semgrep SAST, LLM 분석 단계를 실시간으로 모니터링하세요.
                  </p>
                </div>
              )}

              <div className={`flex flex-col gap-4 pt-4 border-t ${isDark ? 'border-gray-800' : 'border-blue-100'}`}>
                <div className="flex flex-wrap gap-3 justify-between items-center">
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    프로젝트 생성 후 언제든지 설정에서 트리거 모드를 변경할 수 있습니다.
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setError('');
                        setCreateFormData(getInitialCreateForm());
                      }}
                      className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl font-semibold border-2 transition ${isDark
                        ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="flex-1 sm:flex-none px-6 py-3 rounded-2xl font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/30 transition-all"
                    >
                      프로젝트 생성
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-red-500 to-rose-600 px-6 py-8 text-white">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-center mb-2">프로젝트 삭제</h3>
              <p className="text-red-100 text-center text-sm">이 작업은 되돌릴 수 없습니다</p>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className="mb-6">
                <p className="text-gray-700 text-center mb-4">
                  정말로 <span className="font-bold text-gray-900">"{deleteConfirmModal.projectName}"</span> 프로젝트를 삭제하시겠습니까?
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">다음 데이터가 영구 삭제됩니다:</p>
                      <ul className="list-disc list-inside space-y-1 text-amber-700">
                        <li>모든 스캔 데이터</li>
                        <li>모든 리포트</li>
                        <li>프로젝트 설정</li>
                        <li>멤버 권한 정보</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirmModal({ show: false, projectId: null, projectName: '' })}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteProject}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  삭제하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
