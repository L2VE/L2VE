import { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // localStorage에서 초기값 가져오기 (기본값: false = 라이트 모드)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  // isDark 상태가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // HTML root element에 클래스 추가/제거 (Tailwind dark mode용)
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // 테마 토글 함수
  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  // 테마 설정 객체 (모든 페이지에서 사용할 스타일)
  const theme = {
    // 배경색
    bg: isDark ? '#0f172a' : '#ffffff',
    bgSecondary: isDark ? '#1e293b' : '#f8fafc',
    
    // 카드 배경
    cardBg: isDark ? 'bg-gray-800/50' : 'bg-white',
    cardBgHover: isDark ? 'bg-gray-700/50' : 'bg-gray-50',
    
    // 테두리
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    borderHover: isDark ? 'border-gray-600' : 'border-indigo-300',
    
    // 텍스트
    text: isDark ? 'text-gray-100' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDark ? 'text-gray-500' : 'text-gray-500',
    
    // 액센트 색상
    accentBg: isDark ? 'bg-blue-500' : 'bg-indigo-500',
    accentText: isDark ? 'text-blue-400' : 'text-indigo-600',
    
    // 그림자
    shadow: isDark ? 'shadow-gray-900/50' : 'shadow-gray-200/50',
    
    // 입력 필드
    input: isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    inputFocus: isDark ? 'focus:border-blue-500 focus:ring-blue-500' : 'focus:border-indigo-500 focus:ring-indigo-500',
  };

  const value = {
    isDark,
    setIsDark,
    toggleTheme,
    theme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

