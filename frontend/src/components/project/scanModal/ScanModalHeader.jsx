import React from 'react';

function ScanModalHeader({ isDark, onClose }) {
  return (
    <div
      className={`sticky top-0 px-8 py-6 ${
        isDark ? 'bg-gray-900/95 border-b border-gray-700' : 'bg-white/95 border-b border-gray-200'
      } backdrop-blur`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            스캔 시작
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            프리셋을 선택하거나 직접 커스터마이징하여 모델과 옵션을 스캔을 구성해보세요.
          </p>
        </div>
        <div className="flex items-start gap-4">
          <dl
            className={`hidden sm:grid grid-cols-2 gap-3 px-5 py-3 rounded-2xl text-sm font-semibold ${
              isDark
                ? 'bg-gray-900/80 border border-gray-600 text-gray-100'
                : 'bg-blue-50 border border-blue-100 text-blue-800'
            }`}
          >
            <div className="flex flex-col gap-1">
              <dt className="uppercase tracking-wide text-sm text-blue-900">Quick Scan</dt>
              <dd className={`${isDark ? 'text-gray-100' : 'text-gray-700'}`}>핵심 취약점을 빠르게 탐지합니다</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="uppercase tracking-wide text-sm text-blue-900">Full Scan</dt>
              <dd className={`${isDark ? 'text-gray-100' : 'text-gray-700'}`}>추가 옵션 단계로 깊이 있는 분석을 제공합니다</dd>
            </div>
          </dl>
          <button
            onClick={onClose}
            className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} transition-colors self-start`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScanModalHeader;


