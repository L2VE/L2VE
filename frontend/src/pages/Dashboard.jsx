import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        navigate('/login');
      } else {
        const userData = localStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-900">
      {/* Grafana-style Animated Mesh Gradient Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"></div>
        
        {/* Animated mesh gradient blobs - naturally flowing */}
        <div className="absolute inset-0">
          {/* Blob 1 - Purple/Pink */}
          <div 
            className="absolute w-[900px] h-[900px] rounded-full opacity-35 mix-blend-screen filter blur-[140px] animate-blob"
            style={{
              background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.9) 0%, rgba(236, 72, 153, 0.7) 35%, rgba(244, 114, 182, 0.5) 60%, transparent 80%)',
              top: '-25%',
              left: '-15%',
            }}
          ></div>
          
          {/* Blob 2 - Blue/Cyan */}
          <div 
            className="absolute w-[800px] h-[800px] rounded-full opacity-40 mix-blend-screen filter blur-[140px] animate-blob-reverse"
            style={{
              background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.9) 0%, rgba(14, 165, 233, 0.7) 35%, rgba(34, 211, 238, 0.5) 60%, transparent 80%)',
              top: '-15%',
              right: '-15%',
              animationDelay: '2s',
            }}
          ></div>
          
          {/* Blob 3 - Orange/Red */}
          <div 
            className="absolute w-[850px] h-[850px] rounded-full opacity-30 mix-blend-screen filter blur-[140px] animate-blob-slow"
            style={{
              background: 'radial-gradient(circle at center, rgba(249, 115, 22, 0.9) 0%, rgba(239, 68, 68, 0.7) 35%, rgba(251, 146, 60, 0.5) 60%, transparent 80%)',
              bottom: '-20%',
              left: '5%',
              animationDelay: '4s',
            }}
          ></div>
          
          {/* Blob 4 - Indigo/Purple */}
          <div 
            className="absolute w-[750px] h-[750px] rounded-full opacity-40 mix-blend-screen filter blur-[140px] animate-blob"
            style={{
              background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.7) 35%, rgba(167, 139, 250, 0.5) 60%, transparent 80%)',
              bottom: '-15%',
              right: '10%',
              animationDelay: '6s',
            }}
          ></div>
          
          {/* Blob 5 - Pink/Violet */}
          <div 
            className="absolute w-[700px] h-[700px] rounded-full opacity-35 mix-blend-screen filter blur-[140px] animate-blob-reverse"
            style={{
              background: 'radial-gradient(circle at center, rgba(219, 39, 119, 0.8) 0%, rgba(168, 85, 247, 0.6) 35%, rgba(192, 132, 252, 0.4) 60%, transparent 80%)',
              top: '25%',
              left: '35%',
              animationDelay: '3s',
            }}
          ></div>

          {/* Additional small accent blobs for more depth */}
          <div 
            className="absolute w-[500px] h-[500px] rounded-full opacity-25 mix-blend-screen filter blur-[120px] animate-blob-slow"
            style={{
              background: 'radial-gradient(circle at center, rgba(14, 165, 233, 0.7) 0%, rgba(99, 102, 241, 0.5) 50%, transparent 80%)',
              top: '40%',
              right: '30%',
              animationDelay: '1s',
            }}
          ></div>
        </div>
        
        {/* Noise texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          }}
        ></div>
        
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="backdrop-blur-xl bg-white/5 border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 group">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity"></div>
                  <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
                  L2VE
                </h1>
              </div>
              
              <button
                onClick={handleLogout}
                className="group relative px-6 py-3 bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white rounded-xl border border-white/10 hover:border-red-400/50 transition-all duration-300 font-semibold"
              >
                <div className="flex items-center space-x-2">
                  <span>로그아웃</span>
                  <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-12">
          {/* Welcome Section */}
          <div className="mb-16 animate-slide-up">
            <div className="backdrop-blur-2xl bg-white/10 rounded-3xl p-12 border border-white/20 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-5xl font-black text-white mb-4 drop-shadow-lg">
                      반갑습니다, <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-x">{user?.username || 'User'}</span>님! 👋
                    </h2>
                    <p className="text-xl text-gray-300 mb-6 font-medium">
                      보안 대시보드가 준비되었습니다. 모든 시스템이 정상 작동 중입니다.
                    </p>
                    {user && (
                      <div className="space-y-2 text-gray-300 font-medium">
                        <p className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                          </svg>
                          <span className="text-white font-bold">이메일:</span>
                          <span>{user.email}</span>
                        </p>
                        <p className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-white font-bold">이름:</span>
                          <span>{user.full_name}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-8xl animate-bounce-slow">🎉</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              { icon: '🛡️', title: '활성 보호', value: '100%', color: 'from-green-400 to-emerald-500', bgColor: 'from-green-500/20 to-emerald-500/20' },
              { icon: '⚡', title: '응답 시간', value: '<1ms', color: 'from-yellow-400 to-orange-500', bgColor: 'from-yellow-500/20 to-orange-500/20' },
              { icon: '🎯', title: '차단된 위협', value: '0', color: 'from-blue-400 to-cyan-500', bgColor: 'from-blue-500/20 to-cyan-500/20' },
            ].map((stat, index) => (
              <div 
                key={index} 
                className="backdrop-blur-2xl bg-white/10 rounded-3xl p-8 border border-white/20 shadow-xl relative overflow-hidden group hover:scale-105 transition-all duration-500 cursor-default animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgColor} opacity-50 group-hover:opacity-70 transition-opacity`}></div>
                <div className="relative">
                  <div className="flex items-start justify-between mb-6">
                    <div className="text-6xl transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 drop-shadow-lg">
                      {stat.icon}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-gray-300 font-bold text-lg mb-2">{stat.title}</h3>
                  <p className={`text-5xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: '🔍',
                title: '실시간 모니터링',
                description: '모든 시스템에 대한 지속적인 스캔 및 위협 탐지',
                features: ['24/7 상시 모니터링', '즉각 알림', '자동화된 대응'],
                color: 'from-blue-500 to-cyan-500'
              },
              {
                icon: '🚀',
                title: '성능 분석',
                description: '보안 상태 및 시스템 상태에 대한 심층 인사이트',
                features: ['고급 지표', '맞춤 리포트', '트렌드 분석'],
                color: 'from-purple-500 to-pink-500'
              },
            ].map((feature, index) => (
              <div 
                key={index} 
                className="backdrop-blur-2xl bg-white/10 rounded-3xl p-10 border border-white/20 shadow-xl relative overflow-hidden group hover:border-white/30 transition-all duration-500 animate-fade-in"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-shimmer"></div>
                </div>
                
                <div className="relative">
                  <div className="flex items-start space-x-6 mb-8">
                    <div className="text-7xl transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 drop-shadow-lg">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-3xl font-black mb-3 bg-gradient-to-r ${feature.color} bg-clip-text text-transparent`}>
                        {feature.title}
                      </h3>
                      <p className="text-gray-300 text-lg font-medium">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                  
                  <ul className="space-y-3">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="flex items-center space-x-3 text-gray-300 font-medium">
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${feature.color}`}></div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
