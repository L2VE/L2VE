import React from 'react';

function ScanFooter({ isDark, onClose, scanSubmitting, scanStatus }) {
  const renderLabel = () => {
    if (scanStatus === 'completed') {
      return '완료됨';
    }
    if (scanStatus === 'failed') {
      return scanSubmitting ? '시작 중...' : '다시 시도';
    }
    return scanSubmitting ? '시작 중...' : '스캔 시작';
  };

  return (
    <div
      className={`lg:col-span-2 flex items-center justify-end space-x-3 pt-4 ${
        isDark ? 'border-t border-gray-700' : 'border-t border-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={onClose}
        className={`px-6 py-3 font-semibold rounded-xl transition-all ${
          isDark ? 'bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        취소
      </button>
      <button
        type="submit"
        disabled={scanSubmitting}
        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {renderLabel()}
      </button>
    </div>
  );
}

export default ScanFooter;

