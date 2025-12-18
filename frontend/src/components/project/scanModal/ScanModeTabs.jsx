import React from 'react';

function ScanModeTabs({ isDark, modeOptions, mode, handleModeChange, badgeClass }) {
  return (
    <div className="lg:col-span-2">
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-2xl border ${
          isDark ? 'bg-gray-900/70 border-gray-600' : 'bg-gray-100 border-gray-200'
        }`}
      >
        {modeOptions.map((option) => (
          <label key={option.value} className={badgeClass(option.value)}>
            <input
              type="radio"
              name="mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => handleModeChange(option.value)}
              className="sr-only"
            />
            {option.title}
          </label>
        ))}
      </div>
    </div>
  );
}

export default ScanModeTabs;


