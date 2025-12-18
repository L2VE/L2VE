import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';
import api from '../services/api';
import AppNavbar from '../components/common/AppNavbar';
import { useTheme } from '../hooks/useTheme';

function Admin() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'teams', 'projects'
  
  // Users
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Teams
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [newTeamData, setNewTeamData] = useState({ name: '', description: '' });
  
  // Projects
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    const init = async () => {
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }

      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Superuser가 아니면 Home으로 리다이렉트
        if (!parsedUser.is_superuser) {
          alert('Admin 권한이 필요합니다.');
          navigate('/home');
          return;
        }
      }

      // Load initial data
      loadUsers();
      loadTeams();
      loadProjects();
    };
    
    init();
  }, [navigate]);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // ==================== Users ====================
  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleUserActive = async (userId, currentStatus) => {
    try {
      await api.patch(`/admin/users/${userId}`, {
        is_active: !currentStatus
      });
      loadUsers();
    } catch (error) {
      alert('Failed to update user status');
    }
  };

  const toggleUserSuperuser = async (userId, currentStatus) => {
    try {
      await api.patch(`/admin/users/${userId}`, {
        is_superuser: !currentStatus
      });
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to update user privileges');
    }
  };

  // ==================== Teams ====================
  const loadTeams = async () => {
    try {
      setLoadingTeams(true);
      const response = await api.get('/admin/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const createTeam = async () => {
    if (!newTeamData.name.trim()) {
      alert('팀 이름을 입력하세요');
      return;
    }
    
    try {
      await api.post('/admin/teams', newTeamData);
      setNewTeamData({ name: '', description: '' });
      loadTeams();
    } catch (error) {
      alert('Failed to create team');
    }
  };

  const deleteTeam = async (teamId) => {
    if (!confirm('정말 이 팀을 삭제하시겠습니까?')) return;
    
    try {
      await api.delete(`/admin/teams/${teamId}`);
      loadTeams();
    } catch (error) {
      alert('Failed to delete team');
    }
  };

  const viewTeamMembers = async (team) => {
    try {
      const response = await api.get(`/admin/teams/${team.id}/members`);
      setTeamMembers(response.data);
      setSelectedTeam(team);
      setShowTeamModal(true);
    } catch (error) {
      alert('Failed to load team members');
    }
  };

  const addTeamMember = async (teamId, userId, isManager = false) => {
    try {
      await api.post(`/admin/teams/${teamId}/members`, {
        user_id: parseInt(userId),
        is_manager: isManager
      });
      viewTeamMembers(selectedTeam); // Reload members
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add team member');
    }
  };

  const removeTeamMember = async (teamId, userId) => {
    if (!confirm('이 멤버를 팀에서 제거하시겠습니까?')) return;
    
    try {
      await api.delete(`/admin/teams/${teamId}/members/${userId}`);
      viewTeamMembers(selectedTeam); // Reload members
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to remove team member');
    }
  };

  const toggleTeamManager = async (teamId, userId, currentStatus) => {
    try {
      await api.patch(`/admin/teams/${teamId}/members/${userId}?is_manager=${!currentStatus}`);
      viewTeamMembers(selectedTeam); // Reload members
    } catch (error) {
      alert('Failed to update member role');
    }
  };

  // ==================== Projects ====================
  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await api.get('/admin/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const assignTeamToProject = async (projectId, teamId) => {
    try {
      await api.patch(`/admin/projects/${projectId}`, {
        team_id: teamId ? parseInt(teamId) : null
      });
      loadProjects();
    } catch (error) {
      alert('Failed to assign team');
    }
  };

  const toggleProjectStatus = async (projectId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await api.patch(`/admin/projects/${projectId}`, {
        status: newStatus
      });
      loadProjects();
    } catch (error) {
      alert('Failed to update project status');
    }
  };

  const deleteProject = async (projectId) => {
    if (!confirm('정말 이 프로젝트를 삭제하시겠습니까?')) return;
    
    try {
      await api.delete(`/admin/projects/${projectId}`);
      loadProjects();
    } catch (error) {
      alert('Failed to delete project');
    }
  };

  const textPrimary = isDark ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';
  const glassCardBase = isDark
    ? 'bg-gray-900/70 backdrop-blur-xl border border-gray-700 shadow-2xl shadow-black/30'
    : 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-2xl shadow-purple-500/10';
  const glassCardCyan = isDark
    ? 'bg-gray-900/70 backdrop-blur-xl border border-gray-700 shadow-2xl shadow-cyan-500/10'
    : 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-2xl shadow-cyan-500/10';
  const glassCardPink = isDark
    ? 'bg-gray-900/70 backdrop-blur-xl border border-gray-700 shadow-2xl shadow-pink-500/10'
    : 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-2xl shadow-pink-500/10';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-950 via-gray-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
      {/* Animated Background Mesh Gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className={`absolute top-0 -left-4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob ${isDark ? 'bg-indigo-700/20' : 'bg-purple-300/20'}`}></div>
        <div className={`absolute top-0 -right-4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000 ${isDark ? 'bg-cyan-600/20' : 'bg-cyan-300/20'}`}></div>
        <div className={`absolute -bottom-8 left-20 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000 ${isDark ? 'bg-pink-600/20' : 'bg-pink-300/20'}`}></div>
      </div>

      <AppNavbar
        user={user}
        handleLogout={handleLogout}
        breadcrumb={{
          items: [
            { label: '관리자' }
          ]
        }}
      />

      {/* Main Content */}
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-[1600px] mx-auto">
          {/* Header - Awwwards Style */}
          <div className="mb-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h1 className={`text-6xl font-bold bg-clip-text text-transparent mb-3 tracking-tight ${isDark ? 'bg-gradient-to-r from-purple-200 via-indigo-200 to-purple-300' : 'bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900'}`}>
                  Admin Panel
                </h1>
                <p className={`text-lg font-light ${textSecondary}`}>플랫폼 관리 및 제어 센터</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`px-4 py-2 rounded-xl border ${isDark ? 'bg-purple-500/15 border-purple-500/30' : 'bg-gradient-to-r from-purple-100 to-indigo-100 border-purple-100/50'}`}>
                  <p className={`text-xs font-medium ${isDark ? 'text-purple-200' : 'text-purple-700'}`}>전체 사용자</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-purple-100' : 'text-purple-900'}`}>{users.length}</p>
                </div>
                <div className={`px-4 py-2 rounded-xl border ${isDark ? 'bg-cyan-500/15 border-cyan-500/30' : 'bg-gradient-to-r from-cyan-100 to-blue-100 border-cyan-100/50'}`}>
                  <p className={`text-xs font-medium ${isDark ? 'text-cyan-200' : 'text-cyan-700'}`}>팀</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-cyan-100' : 'text-cyan-900'}`}>{teams.length}</p>
                </div>
                <div className={`px-4 py-2 rounded-xl border ${isDark ? 'bg-pink-500/15 border-pink-500/30' : 'bg-gradient-to-r from-pink-100 to-rose-100 border-pink-100/50'}`}>
                  <p className={`text-xs font-medium ${isDark ? 'text-pink-200' : 'text-pink-700'}`}>프로젝트</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-pink-100' : 'text-pink-900'}`}>{projects.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs - Modern Bento Style */}
          <div className="flex items-center space-x-3 mb-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`relative px-6 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 ${
                activeTab === 'users'
                  ? `${isDark ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/40 ring-1 ring-purple-400/40' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 ring-1 ring-purple-300/60'}`
                  : `${isDark ? 'bg-gray-800/70 border border-gray-700 text-gray-300 hover:bg-gray-700/70 hover:shadow-lg hover:shadow-purple-500/20' : 'bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white hover:shadow-md'}`
              }`}
            >
              <span className="relative z-10 flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>사용자</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`relative px-6 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 ${
                activeTab === 'teams'
                  ? `${isDark ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/40 ring-1 ring-cyan-400/40' : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30 ring-1 ring-cyan-300/60'}`
                  : `${isDark ? 'bg-gray-800/70 border border-gray-700 text-gray-300 hover:bg-gray-700/70 hover:shadow-lg hover:shadow-cyan-500/20' : 'bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white hover:shadow-md'}`
              }`}
            >
              <span className="relative z-10 flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>팀</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`relative px-6 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 ${
                activeTab === 'projects'
                  ? `${isDark ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/40 ring-1 ring-pink-400/40' : 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/30 ring-1 ring-pink-300/60'}`
                  : `${isDark ? 'bg-gray-800/70 border border-gray-700 text-gray-300 hover:bg-gray-700/70 hover:shadow-lg hover:shadow-pink-500/20' : 'bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white hover:shadow-md'}`
              }`}
            >
              <span className="relative z-10 flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span>프로젝트</span>
              </span>
            </button>
          </div>

          {/* Tab Content - Glassmorphism Cards */}
          <div className="relative">
            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="animate-fade-in">
                <div className={`${glassCardBase} p-8`}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className={`text-3xl font-bold bg-clip-text text-transparent ${isDark ? 'bg-gradient-to-r from-purple-200 to-indigo-200' : 'bg-gradient-to-r from-purple-900 to-indigo-900'}`}>
                      사용자 관리
                    </h2>
                    <div className={`px-4 py-2 rounded-xl border ${isDark ? 'bg-purple-500/15 border-purple-500/30 text-purple-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                      <span className="text-sm font-medium">전체 {users.length}명</span>
                    </div>
                  </div>
                  
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-12">
                      <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-purple-400' : 'border-purple-600'}`}></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {users.map((u) => (
                        <div 
                          key={u.id} 
                          className={`group relative rounded-2xl p-6 border transition-all duration-300 ${
                            isDark
                              ? 'bg-gray-900/70 border-gray-700 hover:border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/20'
                              : 'bg-gradient-to-br from-white to-gray-50 rounded-2xl border-gray-200 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/10'
                          } hover:-translate-y-1`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${isDark ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 'bg-gradient-to-br from-purple-600 to-indigo-600'}`}>
                                <span className="text-lg font-bold text-white">{u.username?.charAt(0).toUpperCase()}</span>
                                <svg className={`absolute -bottom-1 -right-1 w-5 h-5 ${isDark ? 'text-purple-200' : 'text-purple-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                              </div>
                              <div>
                                <h3 className={`text-lg font-bold ${textPrimary}`}>{u.username}</h3>
                                <p className={`text-xs ${textSecondary}`}>ID: {u.id}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <p className={`text-sm truncate ${textSecondary}`}>{u.email}</p>
                            {u.full_name && <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{u.full_name}</p>}
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleUserActive(u.id, u.is_active)}
                              className={`flex-1 px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-300 border ${
                                u.is_active
                                  ? `${isDark ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`
                                  : `${isDark ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`
                              }`}
                            >
                              <span className="flex items-center justify-center space-x-1">
                                <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
                                <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                              </span>
                            </button>
                            <button
                              onClick={() => toggleUserSuperuser(u.id, u.is_superuser)}
                              disabled={u.id === user?.id}
                              className={`flex-1 px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-300 ${
                                u.is_superuser
                                  ? `${isDark ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-purple-500/30' : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-purple-500/30'}`
                                  : `${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {u.is_superuser ? '★ Admin' : '☆ Member'}
                            </button>
                          </div>

                          <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>가입일 {new Date(u.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Teams Tab */}
            {activeTab === 'teams' && (
              <div className="animate-fade-in">
                <div className={`${glassCardCyan} p-8`}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className={`text-3xl font-bold bg-clip-text text-transparent ${isDark ? 'bg-gradient-to-r from-cyan-200 to-blue-200' : 'bg-gradient-to-r from-cyan-900 to-blue-900'}`}>
                      팀 관리
                    </h2>
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        placeholder="팀 이름"
                        value={newTeamData.name}
                        onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
                        className={`px-4 py-2 text-sm rounded-xl transition-all focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 ${
                          isDark ? 'bg-gray-800 border border-cyan-500/30 text-gray-100 placeholder-gray-500' : 'border-2 border-cyan-200'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="설명 (선택사항)"
                        value={newTeamData.description}
                        onChange={(e) => setNewTeamData({ ...newTeamData, description: e.target.value })}
                        className={`px-4 py-2 text-sm rounded-xl transition-all focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 ${
                          isDark ? 'bg-gray-800 border border-cyan-500/30 text-gray-100 placeholder-gray-500' : 'border-2 border-cyan-200'
                        }`}
                      />
                      <button
                        onClick={createTeam}
                        className={`px-6 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-300 flex items-center space-x-2 ${
                          isDark
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40'
                            : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>팀 생성</span>
                      </button>
                    </div>
                  </div>
                  
                  {loadingTeams ? (
                    <div className="flex items-center justify-center py-12">
                      <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-cyan-400' : 'border-cyan-600'}`}></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {teams.map((team) => (
                        <div 
                          key={team.id} 
                          className={`group relative rounded-2xl p-6 border transition-all duration-300 overflow-hidden ${
                            isDark
                              ? 'bg-gray-900/70 border-gray-700 hover:border-cyan-400/50 hover:shadow-xl hover:shadow-cyan-500/20'
                              : 'bg-gradient-to-br from-white via-cyan-50/30 to-blue-50/30 border-cyan-200 hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-500/20'
                          } hover:-translate-y-1`}
                        >
                          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 ${isDark ? 'bg-gradient-to-br from-cyan-400/20 to-transparent' : 'bg-gradient-to-br from-cyan-400/10 to-transparent'}`}></div>
                          
                          <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h3 className={`text-xl font-bold mb-1 transition-colors ${isDark ? 'text-gray-100 group-hover:text-cyan-300' : 'text-gray-900 group-hover:text-cyan-700'}`}>{team.name}</h3>
                                <p className={`text-xs line-clamp-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{team.description || '설명 없음'}</p>
                              </div>
                              <button
                                onClick={() => deleteTeam(team.id)}
                                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}
                                title="Delete team"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>

                            <div className={`flex items-center justify-between pt-4 border-t ${isDark ? 'border-cyan-500/20' : 'border-cyan-200'}`}>
                              <div className="flex items-center space-x-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-cyan-500 to-blue-500' : 'bg-gradient-to-br from-cyan-500 to-blue-500'}`}>
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                  </svg>
                                </div>
                                <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{team.member_count}명</span>
                              </div>
                              <button
                                onClick={() => viewTeamMembers(team)}
                                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                                  isDark
                                    ? 'bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
                                    : 'bg-gradient-to-r from-cyan-100 to-blue-100 hover:from-cyan-200 hover:to-blue-200 text-cyan-700'
                                }`}
                              >
                                관리
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="animate-fade-in">
                <div className={`${glassCardPink} p-8`}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className={`text-3xl font-bold bg-clip-text text-transparent ${isDark ? 'bg-gradient-to-r from-pink-200 to-rose-200' : 'bg-gradient-to-r from-pink-900 to-rose-900'}`}>
                      프로젝트 관리
                    </h2>
                    <div className={`px-4 py-2 rounded-xl border ${isDark ? 'bg-pink-500/15 border-pink-500/30 text-pink-200' : 'bg-pink-100 text-pink-700 border-pink-200'}`}>
                      <span className="text-sm font-medium">전체 {projects.length}개</span>
                    </div>
                  </div>
                  
                  {loadingProjects ? (
                    <div className="flex items-center justify-center py-12">
                      <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-pink-400' : 'border-pink-600'}`}></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {projects.map((proj) => (
                        <div 
                          key={proj.id} 
                          className={`group relative rounded-2xl p-6 border transition-all duration-300 ${
                            isDark
                              ? 'bg-gray-900/70 border-gray-700 hover:border-pink-400/50 hover:shadow-xl hover:shadow-pink-500/20'
                              : 'bg-gradient-to-br from-white to-pink-50/30 border-pink-200 hover:border-pink-400 hover:shadow-xl hover:shadow-pink-500/20'
                          } hover:-translate-y-1`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h3 className={`text-xl font-bold transition-colors ${isDark ? 'text-gray-100 group-hover:text-pink-300' : 'text-gray-900 group-hover:text-pink-700'}`}>{proj.name}</h3>
                                {/* Status Toggle Button */}
                                <button
                                  onClick={() => toggleProjectStatus(proj.id, proj.status)}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                                    proj.status === 'active' 
                                      ? `${isDark ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`
                                      : `${isDark ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`
                                  }`}
                                  title={`Click to ${proj.status === 'active' ? 'deactivate' : 'activate'}`}
                                >
                                  <span className="flex items-center justify-center space-x-1">
                                    <span className={`w-2 h-2 rounded-full ${proj.status === 'active' ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
                                    <span>{proj.status === 'active' ? 'Active' : 'Inactive'}</span>
                                  </span>
                                </button>
                              </div>
                              <p className={`text-sm line-clamp-2 mb-3 ${textSecondary}`}>{proj.description || '설명 없음'}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>소유자: User #{proj.user_id}</p>
                            </div>
                            <button
                              onClick={() => deleteProject(proj.id)}
                              className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}
                              title="Delete project"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>

                          <div className={`flex items-center justify-between pt-4 border-t ${isDark ? 'border-pink-500/20' : 'border-pink-200'}`}>
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <svg className={`w-4 h-4 ${isDark ? 'text-pink-300' : 'text-pink-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className={`text-xs ${textSecondary}`}>스캔 {proj.total_scans}개</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <svg className={`w-4 h-4 ${isDark ? 'text-amber-300' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className={`text-xs ${textSecondary}`}>이슈 {proj.total_vulnerabilities}개</span>
                              </div>
                            </div>
                            <select
                              value={proj.team_id || ''}
                              onChange={(e) => assignTeamToProject(proj.id, e.target.value)}
                              className={`px-3 py-2 text-xs font-medium rounded-lg transition-all focus:ring-2 focus:ring-pink-500 focus:border-pink-500 ${
                                isDark ? 'bg-gray-900/70 border border-pink-500/30 text-gray-100' : 'border-2 border-pink-200'
                              }`}
                            >
                              <option value="">팀 없음</option>
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Team Members Modal - Glassmorphism */}
      {showTeamModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowTeamModal(false)}>
          <div
            className={`${isDark ? 'bg-gray-900/90 border border-gray-700 shadow-2xl shadow-black/40' : 'bg-white/90 border border-white/60 shadow-2xl'} backdrop-blur-xl rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`sticky top-0 p-6 ${isDark ? 'bg-gradient-to-r from-cyan-600 to-blue-600' : 'bg-gradient-to-r from-cyan-600 to-blue-600'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-bold text-white mb-1">{selectedTeam.name}</h3>
                  <p className="text-sm text-cyan-100">팀 멤버 관리</p>
                </div>
                <button
                  onClick={() => setShowTeamModal(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
              {/* Add Member Form */}
              <div className={`mb-6 p-5 rounded-2xl border ${isDark ? 'bg-gray-900/70 border-cyan-500/30' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200'}`}>
                <h4 className={`text-sm font-bold mb-3 flex items-center space-x-2 ${isDark ? 'text-cyan-200' : 'text-cyan-900'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span>새 멤버 추가</span>
                </h4>
                <div className="flex items-center space-x-3">
                  <select
                    id="newMemberSelect"
                    className={`flex-1 px-4 py-3 text-sm rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all ${
                      isDark ? 'bg-gray-900/80 border border-cyan-500/30 text-gray-100' : 'border-2 border-cyan-300 bg-white'
                    }`}
                  >
                    <option value="">사용자 선택...</option>
                    {users.filter(u => !teamMembers.some(tm => tm.user_id === u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const select = document.getElementById('newMemberSelect');
                      if (select.value) {
                        addTeamMember(selectedTeam.id, select.value, false);
                        select.value = '';
                      }
                    }}
                    className={`px-6 py-3 text-white text-sm font-semibold rounded-xl transition-all duration-300 ${
                      isDark
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/30'
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-lg shadow-cyan-500/30'
                    }`}
                  >
                    멤버 추가
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-3">
                <h4 className={`text-sm font-bold mb-3 ${textPrimary}`}>현재 멤버 ({teamMembers.length}명)</h4>
                {teamMembers.map((member) => (
                  <div 
                    key={member.id} 
                    className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                      isDark
                        ? 'bg-gray-900/60 border-gray-700 hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10'
                        : 'bg-white border-gray-200 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-500/10'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${isDark ? 'bg-gradient-to-br from-cyan-500 to-blue-500' : 'bg-gradient-to-br from-cyan-600 to-blue-600'}`}>
                        <span className="text-lg font-bold text-white">{member.username?.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${textPrimary}`}>{member.username}</p>
                        <p className={`text-xs ${textSecondary}`}>{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleTeamManager(selectedTeam.id, member.user_id, member.is_manager)}
                        className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-300 ${
                          member.is_manager
                            ? `${isDark ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30' : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30'}`
                            : `${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`
                        }`}
                      >
                        {member.is_manager ? '★ Manager' : '☆ Member'}
                      </button>
                      <button
                        onClick={() => removeTeamMember(selectedTeam.id, member.user_id)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}
                        title="멤버 제거"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
