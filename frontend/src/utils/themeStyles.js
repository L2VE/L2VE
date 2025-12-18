export const cardClass = (isDark, lightExtras = '', darkExtras = '') => {
  const base = 'border rounded-2xl transition-all duration-300';
  if (isDark) {
    return `${base} bg-gray-800/60 border-gray-700 text-gray-100 ${darkExtras}`.trim();
  }
  return `${base} bg-white border-gray-300 text-gray-900 ${lightExtras}`.trim();
};

export const softCardClass = (isDark, lightExtras = '', darkExtras = '') => {
  const base = 'border rounded-xl transition-all duration-300';
  if (isDark) {
    return `${base} bg-gray-800/40 border-gray-700 text-gray-100 ${darkExtras}`.trim();
  }
  return `${base} bg-white border-gray-300 text-gray-900 ${lightExtras}`.trim();
};

export const mutedText = (isDark, lightClass = 'text-gray-600', darkClass = 'text-gray-400') =>
  isDark ? darkClass : lightClass;

export const subtleBorder = (isDark) => (isDark ? 'border-gray-700' : 'border-gray-300');


