import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import AppNavbar from '../components/common/AppNavbar';
import jenkinsService from '../services/jenkinsService';
import { useTheme } from '../hooks/useTheme';

function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('api');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);
  
  // API 설정
  const [apiSettings, setApiSettings] = useState({
    groq_api_key: '',
    openai_api_key: '',
    default_provider: 'groq',
    default_model: 'qwen/qwen3-32b',
  });

  // 스캔 설정
  const [scanSettings, setScanSettings] = useState({
    max_concurrent_scans: 3,
    scan_timeout: 3600,
    enable_sast: true,
    auto_retry: true,
    retry_count: 3,
  });

  // 알림 설정
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    scan_complete: true,
    critical_findings: true,
    weekly_report: false,
  });

  const [credentials, setCredentials] = useState([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialError, setCredentialError] = useState('');
  const [credentialSavingId, setCredentialSavingId] = useState(null);
  const { isDark } = useTheme();

  const pageBackgroundClass = isDark
    ? 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-slate-100'
    : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-900';
  const heroCardClass = isDark
    ? 'relative overflow-hidden mb-8 rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-8'
    : 'relative overflow-hidden mb-8 rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl p-8';
  const sidebarCardClass = isDark
    ? 'bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-2'
    : 'bg-white border border-gray-200 rounded-2xl p-4 space-y-2';
  const sidebarButtonClass = (tab) =>
    activeTab === tab
      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
      : isDark
        ? 'text-gray-300 hover:bg-slate-800'
        : 'text-gray-700 hover:bg-gray-100';
  const contentCardClass = isDark
    ? 'bg-slate-900 border border-slate-700 rounded-2xl p-8 text-gray-100'
    : 'bg-white border border-gray-200 rounded-2xl p-8 text-gray-900';
  const secondaryTextClass = isDark ? 'text-gray-400' : 'text-gray-600';
  const mutedTextClass = isDark ? 'text-gray-500' : 'text-gray-400';
  const inputBaseClass = isDark
    ? 'rounded-lg border border-slate-700 bg-slate-900/60 text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
    : 'rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
  const disabledInputClass = isDark
    ? 'border-slate-700 bg-slate-800/60 text-gray-500'
    : 'border-gray-200 bg-gray-50 text-gray-500';
  const refreshButtonClass = isDark
    ? 'px-4 py-2 text-sm font-medium rounded-lg border border-slate-600 text-gray-100 hover:bg-slate-800 disabled:opacity-50'
    : 'px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50';
  const badgeUsernameClass = isDark ? 'bg-indigo-500/15 text-indigo-200' : 'bg-indigo-100 text-indigo-700';
  const badgeSecretClass = isDark ? 'bg-emerald-500/15 text-emerald-200' : 'bg-emerald-100 text-emerald-700';
  const credentialCardClass = isDark
    ? 'rounded-2xl border border-slate-800 p-5 shadow-sm bg-slate-900/80'
    : 'rounded-2xl border border-gray-200 p-5 shadow-sm bg-white';
  const dividerBorderClass = isDark ? 'border-slate-700' : 'border-gray-200';
  const editingInputClass = `w-full px-4 py-3 ${inputBaseClass}`;
  const readOnlyInputClass = `w-full px-4 py-3 ${inputBaseClass} ${disabledInputClass}`;
  const maskedFieldClass = isDark
    ? 'w-full rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-4 py-3 text-gray-500'
    : 'w-full rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-gray-400';
  const heroTitleClass = isDark
    ? 'text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-indigo-200 to-purple-200 bg-clip-text text-transparent'
    : 'text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent';

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.warn('Failed to parse stored user info:', err);
      }
    }

    // 저장된 설정 불러오기 (localStorage 사용)
    const savedApiSettings = localStorage.getItem('apiSettings');
    const savedScanSettings = localStorage.getItem('scanSettings');
    const savedNotificationSettings = localStorage.getItem('notificationSettings');

    if (savedApiSettings) setApiSettings(JSON.parse(savedApiSettings));
    if (savedScanSettings) setScanSettings(JSON.parse(savedScanSettings));
    if (savedNotificationSettings) setNotificationSettings(JSON.parse(savedNotificationSettings));

    loadJenkinsCredentials();
  }, []);

  const loadJenkinsCredentials = async () => {
    setCredentialsLoading(true);
    setCredentialError('');
    try {
      const data = await jenkinsService.getCredentials();
      const normalized = data.map((cred) => ({
        ...cred,
        isEditing: false,
        form: {
          username: cred.requires_username ? cred.username || '' : '',
          secret: '',
        },
      }));
      setCredentials(normalized);
    } catch (error) {
      console.error('Failed to load Jenkins credentials:', error);
      const detail = error?.response?.data?.detail;
      setCredentialError(
        typeof detail === 'string'
          ? detail
          : 'Jenkins 크레덴셜을 불러오지 못했습니다.'
      );
    } finally {
      setCredentialsLoading(false);
    }
  };

  const handleStartEdit = (credentialId) => {
    setCredentialError('');
    setCredentials((prev) =>
      prev.map((cred) =>
        cred.id === credentialId
          ? {
              ...cred,
              isEditing: true,
              form: {
                username: cred.requires_username ? cred.username || '' : '',
                secret: '',
              },
            }
          : { ...cred, isEditing: false }
      )
    );
  };

  const handleCancelEdit = (credentialId) => {
    setCredentials((prev) =>
      prev.map((cred) =>
        cred.id === credentialId
          ? {
              ...cred,
              isEditing: false,
              form: {
                username: cred.requires_username ? cred.username || '' : '',
                secret: '',
              },
            }
          : cred
      )
    );
    setCredentialError('');
  };

  const handleCredentialFieldChange = (credentialId, field, value) => {
    setCredentials((prev) =>
      prev.map((cred) =>
        cred.id === credentialId
          ? { ...cred, form: { ...cred.form, [field]: value } }
          : cred
      )
    );
  };

  const handleSaveCredential = async (credentialId) => {
    const target = credentials.find((cred) => cred.id === credentialId);
    if (!target) return;

    if (!target.form.secret) {
      setCredentialError('새 토큰/비밀번호 값을 입력해주세요.');
      return;
    }

    if (target.requires_username && !target.form.username) {
      setCredentialError('사용자명을 입력해주세요.');
      return;
    }

    const payload = { secret: target.form.secret };
    if (target.requires_username) {
      payload.username = target.form.username;
    }

    setCredentialSavingId(credentialId);
    setCredentialError('');
    setMessage('');

    try {
      await jenkinsService.updateCredential(credentialId, payload);
      setMessage('Jenkins 크레덴셜이 업데이트되었습니다.');
      setTimeout(() => setMessage(''), 4000);
      await loadJenkinsCredentials();
    } catch (error) {
      console.error('Failed to update credential:', error);
      const detail = error?.response?.data?.detail;
      setCredentialError(
        typeof detail === 'string'
          ? detail
          : '크레덴셜 업데이트에 실패했습니다.'
      );
    } finally {
      setCredentialSavingId(null);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleSaveSettings = () => {
    setSaving(true);
    setMessage('');

    // localStorage에 저장 (추후 백엔드 API로 교체)
    try {
      localStorage.setItem('apiSettings', JSON.stringify(apiSettings));
      localStorage.setItem('scanSettings', JSON.stringify(scanSettings));
      localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));

      setMessage('설정이 저장되었습니다');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('설정 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`min-h-screen ${pageBackgroundClass}`}>
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className={`absolute top-0 -left-4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob ${
            isDark ? 'bg-purple-600/30 opacity-10' : 'bg-purple-300 opacity-20'
          }`}
        ></div>
        <div
          className={`absolute top-0 -right-4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000 ${
            isDark ? 'bg-cyan-500/30 opacity-10' : 'bg-cyan-300 opacity-20'
          }`}
        ></div>
        <div
          className={`absolute -bottom-8 left-20 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000 ${
            isDark ? 'bg-pink-500/20 opacity-10' : 'bg-pink-300 opacity-20'
          }`}
        ></div>
      </div>

      <AppNavbar
        user={user}
        handleLogout={handleLogout}
        breadcrumb={{
          items: [
            { label: '홈', to: '/' },
            { label: '설정' }
          ]
        }}
      />

      {/* Main Content */}
      <main className="pt-28 px-8 pb-10">
        <div className="max-w-[1400px] mx-auto">
          {/* Hero Header */}
          <div className={heroCardClass}>
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-gradient-to-br from-indigo-500/15 to-purple-500/15 rounded-full blur-3xl"></div>
            <div className="relative">
              <h1 className={heroTitleClass}>
                설정
              </h1>
              <p className={`mt-3 text-base ${secondaryTextClass} max-w-2xl`}>시스템 환경변수 및 설정 관리</p>
            </div>
          </div>

          {/* Settings Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Tabs */}
            <div className="lg:col-span-1">
              <div className={sidebarCardClass}>
                <button
                  onClick={() => setActiveTab('api')}
                  className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all ${sidebarButtonClass('api')}`}
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Credentials 설정</span>
                  </div>
                </button>

                {/*
                <button
                  onClick={() => setActiveTab('scan')}
                  className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all ${sidebarButtonClass('scan')}`}
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>스캔 설정</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all ${sidebarButtonClass('notifications')}`}
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span>알림 설정</span>
                  </div>
                </button>
                */}
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              <div className={contentCardClass}>
                {/* API Settings */}
                {activeTab === 'api' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Credentials 설정</h2>
                      <p className={`text-sm ${secondaryTextClass}`}>AI API 키 및 기타 인증 정보를 관리합니다</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Jenkins Credential</h3>
                          <p className={`text-sm ${secondaryTextClass}`}>
                            Jenkins에 저장된 키와 토큰을 안전하게 수정할 수 있습니다.
                          </p>
                        </div>
                        <button
                          onClick={loadJenkinsCredentials}
                          disabled={credentialsLoading}
                          className={refreshButtonClass}
                        >
                          새로고침
                        </button>
                      </div>

                      {credentialError && (
                        <div
                          className={`rounded-xl px-4 py-3 text-sm ${
                            isDark
                              ? 'border border-rose-500/40 bg-rose-500/10 text-rose-200'
                              : 'border border-rose-200 bg-rose-50 text-rose-700'
                          }`}
                        >
                          {credentialError}
                        </div>
                      )}

                      {credentialsLoading ? (
                        <div
                          className={`rounded-xl border border-dashed px-4 py-6 text-sm ${
                            isDark ? 'border-slate-700 text-gray-400' : 'border-gray-200 text-gray-500'
                          }`}
                        >
                          크레덴셜을 불러오는 중입니다...
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {credentials.map((cred) => (
                            <div
                              key={cred.id}
                              className={credentialCardClass}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="flex items-center gap-3">
                                    <h4 className="text-lg font-semibold">
                                      {cred.display_name || cred.id}
                                    </h4>
                                    <span
                                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                        cred.credential_type === 'username_password'
                                          ? badgeUsernameClass
                                          : badgeSecretClass
                                      }`}
                                    >
                                      {cred.credential_type === 'username_password'
                                        ? 'Username/Password'
                                        : 'Secret Text'}
                                    </span>
                                  </div>
                                  <p className={`text-sm ${secondaryTextClass}`}>
                                    {cred.description || cred.type_name || cred.id}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {!cred.editable && (
                                    <span className="text-xs text-gray-400">수정 불가</span>
                                  )}
                                  {cred.editable && !cred.isEditing && (
                                    <button
                                      onClick={() => handleStartEdit(cred.id)}
                                      className={
                                        isDark
                                          ? 'rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-slate-800'
                                          : 'rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
                                      }
                                    >
                                      수정
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                {cred.requires_username && (
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                      사용자명
                                    </label>
                                    <input
                                      type="text"
                                      value={cred.form.username}
                                      disabled={!cred.isEditing}
                                      onChange={(e) =>
                                        handleCredentialFieldChange(cred.id, 'username', e.target.value)
                                      }
                                      className={cred.isEditing ? editingInputClass : readOnlyInputClass}
                                      placeholder="사용자명을 입력하세요"
                                    />
                                  </div>
                                )}
                                <div className={cred.requires_username ? '' : 'md:col-span-2'}>
                                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                    {cred.credential_type === 'secret_text' ? '비밀 값' : '비밀번호 / 토큰'}
                                  </label>
                                  {cred.isEditing ? (
                                    <input
                                      type="password"
                                      value={cred.form.secret}
                                      onChange={(e) =>
                                        handleCredentialFieldChange(cred.id, 'secret', e.target.value)
                                      }
                                      className={editingInputClass}
                                      placeholder="새 값을 입력하세요"
                                    />
                                  ) : (
                                    <div className={maskedFieldClass}>********</div>
                                  )}
                                  {cred.isEditing && (
                                    <p className={`mt-1 text-xs ${secondaryTextClass}`}>
                                      값을 입력하고 저장 버튼을 눌러 변경사항을 적용하세요.
                                    </p>
                                  )}
                                </div>
                              </div>

                              {cred.isEditing && (
                                <div className="mt-4 flex items-center justify-end gap-3">
                                  <button
                                    onClick={() => handleCancelEdit(cred.id)}
                                    className={
                                      isDark
                                        ? 'rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-slate-800'
                                        : 'rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
                                    }
                                  >
                                    취소
                                  </button>
                                  <button
                                    onClick={() => handleSaveCredential(cred.id)}
                                    disabled={credentialSavingId === cred.id}
                                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {credentialSavingId === cred.id ? '저장 중...' : '저장'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          {credentials.length === 0 && (
                            <div
                              className={`rounded-xl border border-dashed px-4 py-6 text-sm ${
                                isDark ? 'border-slate-700 text-gray-400' : 'border-gray-200 text-gray-500'
                              }`}
                            >
                              표시할 Jenkins 크레덴셜이 없습니다.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Groq API Key
                        </label>
                        <input
                          type="password"
                          value={apiSettings.groq_api_key}
                          onChange={(e) => setApiSettings({...apiSettings, groq_api_key: e.target.value})}
                          placeholder="gsk_..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">Groq API 키를 입력하세요</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          OpenAI API Key
                        </label>
                        <input
                          type="password"
                          value={apiSettings.openai_api_key}
                          onChange={(e) => setApiSettings({...apiSettings, openai_api_key: e.target.value})}
                          placeholder="sk-..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">OpenAI API 키를 입력하세요</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          기본 Provider
                        </label>
                        <select
                          value={apiSettings.default_provider}
                          onChange={(e) => setApiSettings({...apiSettings, default_provider: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="groq">Groq</option>
                          <option value="openai">OpenAI</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          기본 Model
                        </label>
                        <select
                          value={apiSettings.default_model}
                          onChange={(e) => setApiSettings({...apiSettings, default_model: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <optgroup label="Groq Models">
                            <option value="qwen/qwen3-32b">qwen/qwen3-32b</option>
                            <option value="qwen/qwen3-14b">qwen/qwen3-14b</option>
                            <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                            <option value="llama-3.1-70b-versatile">llama-3.1-70b-versatile</option>
                            <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                            <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                          </optgroup>
                          <optgroup label="OpenAI Models">
                            <option value="gpt-5">gpt-5</option>
                            <option value="gpt-5-mini">gpt-5-mini</option>
                            <option value="gpt-4o">gpt-4o</option>
                            <option value="o3-mini">o3-mini</option>
                          </optgroup>
                        </select>
                      </div>
                    </div> */}
                  </div>
                )}

                {/* Scan Settings */}
                {/* {activeTab === 'scan' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">스캔 설정</h2>
                      <p className="text-sm text-gray-600">스캔 동작 및 성능 관련 설정을 관리합니다</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          최대 동시 스캔 수
                        </label>
                        <input
                          type="number"
                          value={scanSettings.max_concurrent_scans}
                          onChange={(e) => setScanSettings({...scanSettings, max_concurrent_scans: parseInt(e.target.value)})}
                          min="1"
                          max="10"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">동시에 실행할 수 있는 최대 스캔 개수 (1-10)</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          스캔 타임아웃 (초)
                        </label>
                        <input
                          type="number"
                          value={scanSettings.scan_timeout}
                          onChange={(e) => setScanSettings({...scanSettings, scan_timeout: parseInt(e.target.value)})}
                          min="60"
                          max="7200"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">스캔 최대 실행 시간 (60-7200초)</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <div className="text-sm font-medium text-gray-700">SAST 스캔 활성화</div>
                            <div className="text-xs text-gray-500">Semgrep을 사용한 정적 분석</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={scanSettings.enable_sast}
                              onChange={(e) => setScanSettings({...scanSettings, enable_sast: e.target.checked})}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <div className="text-sm font-medium text-gray-700">자동 재시도</div>
                            <div className="text-xs text-gray-500">실패 시 자동으로 재시도</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={scanSettings.auto_retry}
                              onChange={(e) => setScanSettings({...scanSettings, auto_retry: e.target.checked})}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      </div>

                      {scanSettings.auto_retry && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            재시도 횟수
                          </label>
                          <input
                            type="number"
                            value={scanSettings.retry_count}
                            onChange={(e) => setScanSettings({...scanSettings, retry_count: parseInt(e.target.value)})}
                            min="1"
                            max="5"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <p className="mt-1 text-xs text-gray-500">실패 시 재시도할 횟수 (1-5)</p>
                        </div>
                      )}
                    </div>
                  </div>
                )} */}

                {/* Notification Settings */}
                {/* {activeTab === 'notifications' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">알림 설정</h2>
                      <p className="text-sm text-gray-600">이메일 및 시스템 알림 설정을 관리합니다</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-gray-700">이메일 알림</div>
                          <div className="text-xs text-gray-500">모든 이메일 알림 활성화</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notificationSettings.email_notifications}
                            onChange={(e) => setNotificationSettings({...notificationSettings, email_notifications: e.target.checked})}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {notificationSettings.email_notifications && (
                        <>
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg ml-6">
                            <div>
                              <div className="text-sm font-medium text-gray-700">스캔 완료 알림</div>
                              <div className="text-xs text-gray-500">스캔이 완료되면 알림</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={notificationSettings.scan_complete}
                                onChange={(e) => setNotificationSettings({...notificationSettings, scan_complete: e.target.checked})}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg ml-6">
                            <div>
                              <div className="text-sm font-medium text-gray-700">위험 취약점 발견</div>
                              <div className="text-xs text-gray-500">Critical 취약점 발견 시 즉시 알림</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={notificationSettings.critical_findings}
                                onChange={(e) => setNotificationSettings({...notificationSettings, critical_findings: e.target.checked})}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg ml-6">
                            <div>
                              <div className="text-sm font-medium text-gray-700">주간 리포트</div>
                              <div className="text-xs text-gray-500">매주 월요일 요약 리포트 발송</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={notificationSettings.weekly_report}
                                onChange={(e) => setNotificationSettings({...notificationSettings, weekly_report: e.target.checked})}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )} */}

                {/* Save Button & Message */}
                {/* <div className="mt-8 pt-6 border-t border-gray-200">
                  {message && (
                    <div className={`mb-4 p-4 rounded-lg ${
                      message.includes('성공') || message.includes('저장')
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <p className="text-sm font-medium">{message}</p>
                    </div>
                  )}
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? '저장 중...' : '설정 저장'}
                  </button>
                </div> */}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Settings;
