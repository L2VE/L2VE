import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

/**
 * 전역 테마 상태에 접근하기 위한 커스텀 훅
 * 
 * @returns {Object} 테마 관련 상태와 함수들
 * @returns {boolean} isDark - 다크모드 여부
 * @returns {Function} setIsDark - 다크모드 직접 설정
 * @returns {Function} toggleTheme - 다크모드 토글
 * @returns {Object} theme - 테마 스타일 객체
 * 
 * @example
 * const { isDark, toggleTheme, theme } = useTheme();
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

