import React from 'react';

function ScanProgressPanel({ isDark, scanSubmitting, progress, getStageLabel, getStageDescription }) {
  if (!scanSubmitting && !progress) return null;

  return (
    <div
      className={`lg:col-span-2 rounded-2xl border-[3px] p-5 flex flex-col gap-3 ${
        isDark ? 'bg-blue-900/20 border-blue-500/60' : 'bg-blue-50 border-blue-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 border-2 rounded-full border-blue-900 border-t-transparent animate-spin"></span>
        <p className={`text-sm font-semibold ${isDark ? 'text-blue-100' : 'text-blue-800'}`}>
          {progress?.current_message || '파이프라인을 준비하고 있습니다...'}
        </p>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-800/80' : 'bg-white'}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 transition-all duration-500"
          style={{ width: `${progress?.progress_percent || 0}%` }}
        ></div>
      </div>
      <div className={`text-sm leading-5 space-y-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
        {progress?.current_stage && (
          <p className="font-medium">
            현재 단계: <span className="text-blue-600">{getStageLabel(progress.current_stage)}</span>
          </p>
        )}
        {progress?.current_status === 'running' && (
          <ul className="space-y-1 mt-2">
            <li>• {getStageDescription(progress.current_stage)}</li>
          </ul>
        )}
        {!progress && (
          <ul className="space-y-1">
            <li>• Jenkins 대기열에 작업을 등록하는 중</li>
            <li>• 워크스페이스 초기화 및 컨테이너 준비</li>
            <li>• LLM 분석과 SAST 결과를 수집하여 백엔드로 전송합니다</li>
          </ul>
        )}
      </div>
    </div>
  );
}

export default ScanProgressPanel;


