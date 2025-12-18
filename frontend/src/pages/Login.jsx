import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import authService from '../services/authService';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.login(formData);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
                    안전한 개발을 위한<br />
                    <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      AI 보안 플랫폼
                    </span>
                  </h2>
                  <p className="text-lg text-gray-600 leading-relaxed max-w-md">
                  실시간 위협 탐지부터 리포트까지,<br className="hidden md:block" />
                  개발 속도를 떨어뜨리지 않는 보안 자동화.
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 pt-6">
                {[
                  { icon: '⚡', title: '즉각 대응', desc: '실시간 탐지와 빠른 분류', color: 'from-yellow-500 to-orange-500' },
                  { icon: '🔐', title: '최소 리스크', desc: '은행권 표준 암호화', color: 'from-blue-500 to-cyan-500' },
                  { icon: '🎯', title: '클린 리포트', desc: '불필요한 경보 제거', color: 'from-pink-500 to-purple-500' },
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

          {/* Right Side - Login Form */}
          <div className="animate-slide-left">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 p-10 md:p-12">
              <div className="text-center mb-10">
                <h3 className="text-3xl font-bold text-gray-900 mb-2">로그인</h3>
                <p className="text-gray-600">함께 시작해요</p>
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

              <form onSubmit={handleSubmit} className="space-y-6">
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
                      placeholder="비밀번호를 입력하세요"
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
                      <span>로그인 중...</span>
                    </>
                  ) : (
                    <>
                      <span>로그인</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-gray-600">
                  계정이 없으신가요?{' '}
                  <Link
                    to="/signup"
                    className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    회원가입
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

export default Login;
