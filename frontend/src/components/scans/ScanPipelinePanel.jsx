function ScanPipelinePanel({ pipelineData, pipelineLoading, isDark }) {
  if (pipelineLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-cyan-300' : 'border-indigo-600'}`}></div>
        <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>파이프라인 데이터 로딩 중...</span>
      </div>
    );
  }

  if (!pipelineData?.available) {
    return (
      <div className="text-center py-12">
        <svg className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {pipelineData?.message || '파이프라인 로그를 사용할 수 없습니다'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-xl p-3 border border-indigo-200/50">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-gray-900">파이프라인 개요</h4>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              pipelineData.summary?.overall_status === 'completed'
                ? 'bg-emerald-100 text-emerald-700'
                : pipelineData.summary?.overall_status === 'failed'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {(pipelineData.summary?.overall_status || 'unknown').toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: '전체 단계', value: pipelineData.summary?.total_stages || 0, className: 'text-indigo-700' },
            { label: '완료됨', value: pipelineData.summary?.completed || 0, className: 'text-emerald-600' },
            { label: '에러', value: pipelineData.summary?.error_count || 0, className: 'text-amber-600' },
            { label: '경고', value: pipelineData.summary?.warning_count || 0, className: 'text-orange-600' },
          ].map((item) => (
            <div key={item.label}>
              <div className={`text-lg font-bold ${item.className}`}>{item.value}</div>
              <div className="text-xs text-gray-600 mt-0.5 font-medium">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {pipelineData.build_info && (
        <div className="bg-white rounded-xl p-3 border border-gray-200">
          <h5 className="text-xs font-bold text-gray-700 mb-2">빌드 정보</h5>
          <div className="grid grid-cols-4 gap-3 text-xs">
            {pipelineData.build_info.build_number && (
              <div>
                <span className="text-gray-500">빌드:</span>
                <span className="font-semibold text-gray-900 ml-1">#{pipelineData.build_info.build_number}</span>
              </div>
            )}
            {pipelineData.build_info.scan_type && (
              <div>
                <span className="text-gray-500">유형:</span>
                <span className="font-semibold text-gray-900 ml-1">{pipelineData.build_info.scan_type}</span>
              </div>
            )}
            {pipelineData.build_info.provider && (
              <div>
                <span className="text-gray-500">제공자:</span>
                <span className="font-semibold text-gray-900 ml-1">{pipelineData.build_info.provider}</span>
              </div>
            )}
            {pipelineData.build_info.model && (
              <div>
                <span className="text-gray-500">모델:</span>
                <span className="font-semibold text-gray-900 ml-1">
                  {pipelineData.build_info.model.replace(/\)$/, '')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <h5 className="text-sm font-bold text-gray-700 mb-4">파이프라인 단계</h5>
        <div className="relative pl-[50px]">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 via-purple-300 to-pink-300"></div>
          {pipelineData.stages.map((stage, idx) => (
            <div key={idx} className="relative mb-4 group">
              <div
                className={`absolute w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-lg ${
                  stage.status === 'completed'
                    ? 'bg-emerald-500 border-emerald-300'
                    : stage.status === 'failed'
                    ? 'bg-rose-500 border-rose-300 animate-pulse'
                    : 'bg-blue-400 border-blue-300 animate-pulse'
                }`}
                style={{ left: '-35px' }}
              >
                {stage.status === 'completed' ? (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : stage.status === 'failed' ? (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>

              <div className={`bg-white rounded-lg p-3 border-2 transition-all duration-300 group-hover:shadow-lg group-hover:scale-[1.02] ${
                stage.status === 'completed'
                  ? 'border-emerald-200'
                  : stage.status === 'failed'
                  ? 'border-rose-200'
                  : 'border-blue-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <h6 className="font-bold text-sm text-gray-900">{stage.name}</h6>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      stage.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : stage.status === 'failed'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {stage.status}
                  </span>
                </div>

                {stage.key_logs?.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {stage.key_logs
                      .filter((log) => !log.message.includes('빌드 번호:') && !log.message.includes('스캔 타입:'))
                      .map((log, logIdx) => (
                        <div
                          key={logIdx}
                          className={`text-[10px] px-2 py-1.5 rounded-lg border ${
                            log.type === 'error'
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : log.type === 'warning'
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : log.type === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-gray-50 border-gray-200 text-gray-700'
                          }`}
                        >
                          {log.message}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(pipelineData.errors.length > 0 || pipelineData.warnings.length > 0) && (
        <div className="space-y-4">
          {pipelineData.errors.length > 0 && (
            <div>
              <h5 className="text-sm font-bold text-rose-700 mb-2">에러 ({pipelineData.errors.length})</h5>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1">
                {pipelineData.errors.map((err, idx) => (
                  <div key={idx} className="text-xs text-rose-800 font-mono">
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pipelineData.warnings.length > 0 && (
            <div>
              <h5 className="text-sm font-bold text-amber-700 mb-2">경고 ({pipelineData.warnings.length})</h5>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                {pipelineData.warnings.map((warn, idx) => (
                  <div key={idx} className="text-xs text-amber-800 font-mono">
                    {warn}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScanPipelinePanel;
