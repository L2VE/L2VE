/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#e8eef9',
          100: '#d1ddf3',
          200: '#a3bbe7',
          300: '#7599db',
          400: '#4777cf',
          500: '#1a4d8f',  // 메인 네이비
          600: '#163e73',
          700: '#122f57',
          800: '#0d203b',
          900: '#09101f',
        },
        secondary: {
          50: '#fef3e8',
          100: '#fde7d1',
          200: '#fbcfa3',
          300: '#f9b775',
          400: '#f79f47',
          500: '#f58719',  // 오렌지 액센트
          600: '#c46c14',
          700: '#93510f',
          800: '#62360a',
          900: '#311b05',
        },
        navy: {
          50: '#e6eef9',
          100: '#ccddf3',
          200: '#99bbe7',
          300: '#6699db',
          400: '#3377cf',
          500: '#0055c3',  // 브라이트 네이비
          600: '#00449c',
          700: '#003375',
          800: '#00224e',
          900: '#001127',
        },
      },
      animation: {
        'gradient': 'gradient 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.6s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'bounce-slow': 'bounceSlow 2s ease-in-out infinite',
        'blob': 'blob 18s ease-in-out infinite',
        'blob-reverse': 'blobReverse 16s ease-in-out infinite',
        'blob-slow': 'blobSlow 20s ease-in-out infinite',
        'gradient-x': 'gradientX 15s ease infinite',
        'gradient-y': 'gradientY 15s ease infinite',
        'gradient-xy': 'gradientXY 20s ease infinite',
        'spin-slow': 'spin 20s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-20px)',
          },
        },
        slideUp: {
          '0%': {
            transform: 'translateY(100px)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
        slideInRight: {
          '0%': {
            transform: 'translateX(100px)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: '1',
          },
        },
        fadeIn: {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
        bounceSlow: {
          '0%, 100%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-10px)',
          },
        },
        blob: {
          '0%, 100%': {
            transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
          },
          '20%': {
            transform: 'translate(250px, -200px) scale(1.2) rotate(45deg)',
          },
          '40%': {
            transform: 'translate(120px, 250px) scale(0.85) rotate(-30deg)',
          },
          '60%': {
            transform: 'translate(-200px, 180px) scale(1.15) rotate(50deg)',
          },
          '80%': {
            transform: 'translate(-150px, -150px) scale(0.8) rotate(-25deg)',
          },
        },
        blobReverse: {
          '0%, 100%': {
            transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
          },
          '20%': {
            transform: 'translate(-250px, 200px) scale(0.8) rotate(-45deg)',
          },
          '40%': {
            transform: 'translate(-120px, -250px) scale(1.2) rotate(30deg)',
          },
          '60%': {
            transform: 'translate(200px, -180px) scale(0.85) rotate(-50deg)',
          },
          '80%': {
            transform: 'translate(150px, 150px) scale(1.15) rotate(25deg)',
          },
        },
        blobSlow: {
          '0%, 100%': {
            transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
          },
          '25%': {
            transform: 'translate(220px, -220px) scale(1.18) rotate(35deg)',
          },
          '50%': {
            transform: 'translate(-80px, 220px) scale(0.82) rotate(-28deg)',
          },
          '75%': {
            transform: 'translate(-220px, -80px) scale(1.12) rotate(20deg)',
          },
        },
        gradientX: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
        gradientY: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'center top',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'center bottom',
          },
        },
        gradientXY: {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': 'left top',
          },
          '25%': {
            'background-size': '400% 400%',
            'background-position': 'right top',
          },
          '50%': {
            'background-size': '400% 400%',
            'background-position': 'right bottom',
          },
          '75%': {
            'background-size': '400% 400%',
            'background-position': 'left bottom',
          },
        },
        shimmer: {
          '0%': {
            transform: 'translateX(-100%)',
          },
          '100%': {
            transform: 'translateX(100%)',
          },
        },
      },
    },
  },
  plugins: [],
}

