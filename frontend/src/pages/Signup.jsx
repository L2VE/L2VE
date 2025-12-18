import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';

function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [focusedField, setFocusedField] = useState('');

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 6) strength += 20;
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 10;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
    return Math.min(strength, 100);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }

    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      setLoading(false);
      return;
    }

    const { confirmPassword, ...signupData } = formData;

    try {
      await authService.signup(signupData);
      navigate('/home');
    } catch (err) {
      setError(err || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 40) return 'bg-red-500';
    if (passwordStrength < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength < 40) return '약함';
    if (passwordStrength < 70) return '보통';
    return '강함';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Subtle Animated Background - Home 페이지와 동일 */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="w-full max-w-6xl mx-auto relative z-10 px-6 py-12 min-h-screen flex items-center animate-fade-in">
        <div className="grid md:grid-cols-2 gap-16 items-center w-full">
          {/* Left Side - Branding */}
          <div className="hidden md:block animate-slide-right">
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center space-x-4 group">
                  <img src="/images/logo.png" alt="L2VE" className="h-14 w-auto" />
                  <h1 className="text-6xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
                    L2VE
                  </h1>
                </div>
                <div className="space-y-4">
                  <h2 className="text-5xl font-bold text-gray-900 leading-tight">
                    AI 보안을<br />
                    <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      바로 시작하세요
                    </span>
                  </h2>
                  <p className="text-lg text-gray-600 leading-relaxed max-w-md">
                    계정만 만들면 L2VE의 모든 기능을 바로 사용할 수 있습니다.
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 pt-6">
                {[
                  { icon: '🚀', title: '자동화된 인사이트', desc: 'AI가 스캔부터 리포트까지', color: 'from-cyan-500 to-blue-500' },
                  { icon: '🛡️', title: '보안·규정 준수', desc: '금융권 수준 보호 체계', color: 'from-purple-500 to-pink-500' },
                  { icon: '📊', title: '의사결정 지원', desc: '핵심 이슈만 콕 집어 제공', color: 'from-orange-500 to-red-500' },
                ].map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm px-5 py-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300">
                    <div className="text-2xl">
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm mb-0.5">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 text-xs">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Signup Form */}
          <div className="animate-slide-left">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 p-10 md:p-12">
              <div className="text-center mb-8">
                <h3 className="text-3xl font-bold text-gray-900 mb-2">회원가입</h3>
                <p className="text-gray-600">지금 바로 시작하세요</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-semibold text-red-700">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                      focusedField === 'email' ? 'text-indigo-600' : 'text-gray-400'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      name="email"
                      required
                      maxLength={255}
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField('')}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                      focusedField === 'username' ? 'text-indigo-600' : 'text-gray-400'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="username"
                      required
                      maxLength={50}
                      value={formData.username}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField('')}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      placeholder="johndoe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                      focusedField === 'full_name' ? 'text-indigo-600' : 'text-gray-400'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="full_name"
                      required
                      maxLength={100}
                      value={formData.full_name}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('full_name')}
                      onBlur={() => setFocusedField('')}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      placeholder="홍길동"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                      focusedField === 'password' ? 'text-indigo-600' : 'text-gray-400'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      maxLength={72}
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField('')}
                      className="w-full pl-12 pr-12 py-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      placeholder="강력한 비밀번호를 생성하세요"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium">비밀번호 강도</span>
                        <span className={`font-bold ${passwordStrength < 40 ? 'text-red-500' : passwordStrength < 70 ? 'text-yellow-500' : 'text-green-500'}`}>
                          {getPasswordStrengthText()}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${getPasswordStrengthColor()}`}
                          style={{ width: `${passwordStrength}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호 확인
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                      focusedField === 'confirmPassword' ? 'text-indigo-600' : 'text-gray-400'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      required
                      maxLength={72}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField('')}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      placeholder="비밀번호를 다시 입력하세요"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-8 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>계정 생성 중...</span>
                    </>
                  ) : (
                    <>
                      <span>계정 만들기</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-gray-600">
                  이미 계정이 있으신가요?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    로그인
                  </Link>
                </p>
              </div>
            </div>
            
            <p className="text-center mt-8 text-sm text-gray-500">
              🔒 Secured by L2VE Platform • © 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
