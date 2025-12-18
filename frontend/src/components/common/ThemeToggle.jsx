function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-14 h-7 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-full transition-colors`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className={`absolute top-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
        isDark ? 'bg-blue-500 left-0.5' : 'bg-yellow-500 right-0.5'
      }`}>
        {isDark ? (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}

export default ThemeToggle;

