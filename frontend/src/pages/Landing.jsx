import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function Landing() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const heroRef = useRef(null);
  const BG_ENABLED = false;

  // 마우스 이펙트 제거 (성능 개선)

  // Particle System 제거 (성능 개선)

  // Mouse Trail 제거 (성능 개선)

  // GSAP Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Split text animation
      const words = heroRef.current?.querySelectorAll('.hero-word');
      
      if (words && words.length > 0) {
        gsap.from(words, {
          y: 200,
          opacity: 0,
          rotationX: -90,
          transformOrigin: 'center bottom',
          stagger: 0.15,
          duration: 1.4,
          ease: 'power4.out',
          delay: 0.3
        });
      }

      gsap.from('.hero-subtitle', {
        y: 50,
        opacity: 0,
        duration: 1.2,
        delay: 1,
        ease: 'power3.out'
      });

      gsap.from('.hero-cta', {
        scale: 0.5,
        opacity: 0,
        duration: 1,
        delay: 1.3,
        ease: 'back.out(1.7)'
      });

      // Parallax
      const sections = gsap.utils.toArray('.parallax-section');
      sections.forEach((section) => {
        gsap.to(section, {
          yPercent: -20,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 2
          }
        });
      });

      // Feature cards
      gsap.utils.toArray('.feature-card').forEach((card, index) => {
        gsap.from(card, {
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          },
          y: 100,
          opacity: 0,
          rotationY: 45,
          duration: 1.2,
          delay: index * 0.15,
          ease: 'power3.out'
        });
      });

      // Stats
      gsap.utils.toArray('.stat-item').forEach((stat, index) => {
        gsap.from(stat, {
          scrollTrigger: {
            trigger: stat,
            start: 'top 90%',
            toggleActions: 'play none none reverse'
          },
          scale: 0,
          opacity: 0,
          duration: 0.8,
          delay: index * 0.08,
          ease: 'back.out(2)'
        });
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Magnetic Effect for buttons
  const handleMagneticMove = (e, element) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    gsap.to(element, {
      x: x * 0.3,
      y: y * 0.3,
      duration: 0.3,
      ease: 'power2.out'
    });
  };

  const handleMagneticLeave = (element) => {
    gsap.to(element, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.3)'
    });
  };

  return (
    <div ref={containerRef} className="bg-black text-white overflow-x-hidden">
      {/* Canvas 제거 (성능 개선) */}

      {/* Liquid Background */}
      {BG_ENABLED && (
        <div className="fixed inset-0 z-0 overflow-hidden">
          <div 
            className="absolute w-[1200px] h-[1200px] rounded-full blur-[150px] opacity-20 animate-blob"
            style={{
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.8) 0%, rgba(139, 92, 246, 0.6) 40%, transparent 70%)',
              top: '-10%',
              left: '10%'
            }}
          />
          <div 
            className="absolute w-[1000px] h-[1000px] rounded-full blur-[140px] opacity-20 animate-blob-reverse"
            style={{
              background: 'radial-gradient(circle, rgba(236, 72, 153, 0.8) 0%, rgba(251, 146, 60, 0.6) 40%, transparent 70%)',
              top: '20%',
              right: '10%',
              animationDelay: '2s'
            }}
          />
          <div 
            className="absolute w-[900px] h-[900px] rounded-full blur-[120px] opacity-15 animate-blob-slow"
            style={{
              background: 'radial-gradient(circle, rgba(14, 165, 233, 0.8) 0%, rgba(34, 211, 238, 0.6) 40%, transparent 70%)',
              bottom: '10%',
              left: '20%',
              animationDelay: '4s'
            }}
          />
        </div>
      )}

      {/* Custom Cursor 제거 (성능 개선) */}

      {/* Minimal UI */}
      <div className="fixed top-8 left-8 z-50 mix-blend-difference">
        <div className="text-xs tracking-[0.3em] font-light">L2VE</div>
      </div>

      <button
        onClick={() => navigate('/login')}
        className="fixed top-8 right-8 z-50 mix-blend-difference text-xs tracking-[0.3em] font-light hover:tracking-[0.5em] transition-all duration-300"
      >
        SIGN IN
      </button>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center relative px-6 z-10">
        <div ref={heroRef} className="relative text-center max-w-7xl mx-auto">
          {/* Animated Title */}
          <h1 className="mb-16 leading-[0.85]" style={{ perspective: '1000px' }}>
            <div className="overflow-hidden mb-2">
              <span 
                className="hero-word inline-block text-[18vw] sm:text-[14vw] md:text-[11vw] lg:text-[9vw] font-black tracking-tighter"
              >
                NEXT
              </span>
            </div>
            <div className="overflow-hidden mb-2">
              <span 
                className="hero-word inline-block text-[18vw] sm:text-[14vw] md:text-[11vw] lg:text-[9vw] font-black tracking-tighter bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent"
              >
                GENERATION
              </span>
            </div>
            <div className="overflow-hidden">
              <span 
                className="hero-word inline-block text-[18vw] sm:text-[14vw] md:text-[11vw] lg:text-[9vw] font-black tracking-tighter"
              >
                SECURITY
              </span>
            </div>
          </h1>

          <p className="hero-subtitle text-base sm:text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-light tracking-wide">
            AI-powered vulnerability detection that evolves with every threat
          </p>

          <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-6">
            <button
              onClick={() => navigate('/login')}
              onMouseMove={(e) => handleMagneticMove(e, e.currentTarget)}
              onMouseLeave={(e) => handleMagneticLeave(e.currentTarget)}
              className="magnetic-btn group relative px-12 py-5 overflow-hidden bg-white text-black font-bold tracking-[0.2em] transition-all duration-300 text-sm sm:text-base"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
              <span className="relative group-hover:text-white transition-colors duration-700">START NOW</span>
            </button>
          </div>
        </div>

        {/* Scroll Hint */}
        <div className="hidden md:block absolute bottom-16 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center gap-3 opacity-40 hover:opacity-100 transition-opacity">
            <div className="text-[10px] tracking-[0.4em] font-light">SCROLL</div>
            <div className="w-[1px] h-20 bg-gradient-to-b from-white to-transparent animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Holographic Cards Section */}
      <section className="parallax-section py-32 md:py-48 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-24 md:mb-32 text-center tracking-tight">
            CAPABILITIES
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: '01',
                title: 'Real-Time Detection',
                desc: 'Instant threat identification',
                icon: '⚡',
                gradient: 'from-cyan-500 via-blue-500 to-indigo-500'
              },
              {
                num: '02',
                title: 'Deep Analysis',
                desc: 'Comprehensive vulnerability assessment',
                icon: '🔍',
                gradient: 'from-purple-500 via-pink-500 to-rose-500'
              },
              {
                num: '03',
                title: 'Automated Response',
                desc: 'Intelligent mitigation strategies',
                icon: '🛡️',
                gradient: 'from-amber-500 via-orange-500 to-red-500'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="feature-card group relative h-[450px] md:h-[550px]"
                onMouseMove={(e) => {
                  const card = e.currentTarget;
                  const rect = card.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  
                  card.style.setProperty('--mouse-x', `${x}px`);
                  card.style.setProperty('--mouse-y', `${y}px`);
                }}
              >
                {/* Holographic Border */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.2), transparent 40%)`
                    }}
                  ></div>
                  <div className="absolute inset-[1px] bg-black rounded-2xl"></div>
                </div>

                {/* Content */}
                <div className="relative h-full p-8 md:p-10 flex flex-col justify-between">
                  <div>
                    
                    <div className={`text-7xl md:text-8xl font-black bg-gradient-to-br ${feature.gradient} bg-clip-text text-transparent mb-6 opacity-10 group-hover:opacity-20 transition-opacity duration-500`}>
                      {feature.num}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-4 group-hover:text-white transition-colors duration-300">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-gray-500 group-hover:text-gray-300 transition-colors duration-500 text-lg">
                    {feature.desc}
                  </p>
                </div>

                {/* Glow Effect */}
                <div 
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(139, 92, 246, 0.1), transparent 60%)`
                  }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Morphing Section */}
      <section className="parallax-section py-32 md:py-48 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
            <div className="order-2 md:order-1">
              {/* Morphing Visualization */}
              <div className="relative h-[400px] md:h-[600px]">
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Orbiting Elements */}
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-full h-full"
                      style={{
                        animation: `spin ${25 - i * 5}s linear infinite ${i % 2 === 0 ? '' : 'reverse'}`
                      }}
                    >
                      <div 
                        className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full`}
                        style={{
                          background: `hsl(${220 + i * 30}, 70%, 60%)`,
                          boxShadow: `0 0 20px hsl(${220 + i * 30}, 70%, 60%)`
                        }}
                      ></div>
                      <div 
                        className="absolute inset-0 rounded-full"
                        style={{
                          border: `1px solid hsla(${220 + i * 30}, 70%, 60%, 0.2)`,
                          transform: `scale(${0.9 - i * 0.15})`
                        }}
                      ></div>
                    </div>
                  ))}
                  
                  {/* Center Core */}
                  <div className="relative z-10">
                    <div className="w-24 h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-2xl animate-pulse"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-white rounded-full"></div>
                    </div>
                  </div>
                </div>

                
              </div>
            </div>

            <div className="order-1 md:order-2">
              <h2 className="text-5xl sm:text-6xl md:text-7xl font-black mb-6 md:mb-8 leading-tight">
                PRECISION
                <br />
                <span 
                  className="inline-block bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent"
                >
                  ENGINEERED
                </span>
              </h2>
              <p className="text-lg md:text-xl text-gray-400 leading-relaxed mb-8">
                Every line of code analyzed. Every vulnerability detected. Every threat neutralized.
              </p>
              <div className="flex items-center gap-8">
                <div className="group cursor-pointer">
                  <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
                    99.9%
                  </div>
                  <div className="text-sm text-gray-500 mt-2">Accuracy</div>
                </div>
                <div className="group cursor-pointer">
                  <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
                    &lt;5ms
                  </div>
                  <div className="text-sm text-gray-500 mt-2">Response</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats with Magnetic Effect */}
      <section className="parallax-section py-32 md:py-40 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { value: '10M+', label: 'THREATS' },
              { value: '500K+', label: 'SCANS' },
              { value: '150+', label: 'COUNTRIES' },
              { value: '24/7', label: 'ACTIVE' }
            ].map((stat, index) => (
              <div
                key={index}
                className="stat-item text-center group cursor-pointer"
                onMouseMove={(e) => handleMagneticMove(e, e.currentTarget)}
                onMouseLeave={(e) => handleMagneticLeave(e.currentTarget)}
              >
                <div className="text-5xl sm:text-6xl md:text-7xl font-black mb-3 transition-all duration-300 group-hover:scale-110">
                  <span
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    {stat.value}
                  </span>
                </div>
                <div className="text-xs tracking-[0.3em] text-gray-500 group-hover:text-gray-300 transition-colors">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 md:py-48 px-6 relative overflow-hidden z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent"></div>
        
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black mb-12 leading-none tracking-tighter">
            READY?
          </h2>
          
          <button
            onClick={() => navigate('/login')}
            onMouseMove={(e) => handleMagneticMove(e, e.currentTarget)}
            onMouseLeave={(e) => handleMagneticLeave(e.currentTarget)}
            className="magnetic-btn group relative px-12 md:px-16 py-5 md:py-6 overflow-hidden bg-white text-black text-lg md:text-xl font-bold tracking-[0.2em] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
            <span className="relative group-hover:text-white transition-colors duration-700">
              BEGIN NOW
            </span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="text-xs text-gray-600">© 2025 L2VE</div>
          <div className="flex gap-8 text-xs text-gray-600">
            <button className="hover:text-white transition-colors tracking-wider">PRIVACY</button>
            <button className="hover:text-white transition-colors tracking-wider">TERMS</button>
            <button className="hover:text-white transition-colors tracking-wider">CONTACT</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;