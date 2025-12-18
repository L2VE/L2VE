import React from 'react';

function PresetConfigPanel({
  isDark,
  sectionClass,
  inputClass,
  selectClass,
  pillClass,
  presetAdvanced,
  scanForm,
  onChange,
  setAdvancedState,
  handleProviderSelect,
  quickProviders,
  safePresetModelOptions,
  getProviderLabel,
  getModelLabel,
  modelSelectValue,
  onModelSelect,
  showCustomModelInput,
  customModelPlaceholder,
}) {
  const renderCodeBadge = (value) => (
    <span
      className={[
        'ml-2 font-mono text-xs px-2 py-0.5 rounded-md border',
        isDark ? 'bg-slate-900 text-blue-200 border-blue-500/40' : 'bg-blue-50 text-blue-800 border-blue-200',
      ].join(' ')}
    >
      {value || '-'}
    </span>
  );

  return (
    <>
      <div className={sectionClass}>
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">모델 프로바이더 설정</h3>
              <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                기본 목록에서 Provider와 모델을 빠르게 선택하거나
                <br className="hidden sm:block" />
                Advanced On으로 옵션 정보를 직접 입력하세요
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 ${
                isDark ? 'bg-gray-900/60 border border-gray-600' : 'bg-gray-100 border border-gray-200'
              } rounded-xl px-2 py-1`}
            >
              <button
                type="button"
                className={pillClass(!presetAdvanced)}
                onClick={() => setAdvancedState('preset_advanced', false, 'preset_provider', 'preset_model', 'preset_model_mode')}
              >
                Off
              </button>
              <button
                type="button"
                className={pillClass(presetAdvanced)}
                onClick={() => setAdvancedState('preset_advanced', true)}
              >
                On
              </button>
            </div>
          </div>

          {!presetAdvanced ? (
            <>
              <div>
                <label className="block text-sm font-bold mb-2 text-blue-800 dark:text-blue-300">Provider 이름</label>
                <select
                  name="preset_provider"
                  value={scanForm.preset_provider}
                  onChange={handleProviderSelect('preset_provider', 'preset_model', 'preset_model_mode')}
                  className={selectClass}
                >
                  {quickProviders.map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-blue-800 dark:text-blue-300">모델 식별자</label>
                <select
                  name="preset_model"
                  value={modelSelectValue}
                  onChange={onModelSelect}
                  className={selectClass}
                >
                  {safePresetModelOptions.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                {showCustomModelInput && (
                  <div className="mt-4 space-y-2">
                    <label className="block text-sm font-bold text-blue-800 dark:text-blue-300">직접 입력한 모델 식별자</label>
                    <input
                      type="text"
                      name="preset_model"
                      value={scanForm.preset_model}
                      onChange={onChange}
                      placeholder={customModelPlaceholder}
                      className={inputClass}
                    />
                    <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      기본 목록에 없는 모델을 사용할 때 직접 입력하세요.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-bold mb-2 text-blue-800 dark:text-blue-300">Provider 이름</label>
                <input
                  type="text"
                  value="OpenAI Compatible"
                  readOnly
                  className={`${inputClass} cursor-not-allowed`}
                />
                <input type="hidden" name="preset_provider" value={scanForm.preset_provider || 'compatible'} />
                <p className={`mt-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Advanced 모드에서는 OpenAI 호환 API에만 연결됩니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-blue-800 dark:text-blue-300">엔드포인트 URL</label>
                <input
                  type="text"
                  name="preset_endpoint"
                  value={scanForm.preset_endpoint}
                  onChange={onChange}
                  placeholder="https://llm.example.com/v1/chat"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-blue-800 dark:text-blue-300">모델 식별자</label>
                <input
                  type="text"
                  name="preset_model"
                  value={scanForm.preset_model}
                  onChange={onChange}
                  placeholder="예: gpt-5, llama3-70b-secure"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-blue-800 dark:text-blue-300">API Key 또는 토큰</label>
                <input
                  type="text"
                  name="preset_api_key"
                  value={scanForm.preset_api_key}
                  onChange={onChange}
                  placeholder="필요 시 입력 (선택, 서버에 암호화 보관)"
                  className={inputClass}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className={sectionClass}>
        <div className="p-5 space-y-4 min-h-[220px] flex flex-col">
          <h3 className="text-sm font-semibold">선택 요약</h3>
          <div className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} space-y-1`}>
            <p>
              Provider:{' '}
              <span className="font-semibold text-blue-600">{getProviderLabel(scanForm.preset_provider)}</span>
              {renderCodeBadge(scanForm.preset_provider)}
            </p>
            <p>
              Model:{' '}
              <span className="font-semibold text-blue-600">
                {getModelLabel(scanForm.preset_provider, scanForm.preset_model)}
              </span>
              {renderCodeBadge(scanForm.preset_model)}
            </p>
            {presetAdvanced && (
              <>
                <p>
                  Endpoint: <span className="font-semibold text-blue-600">{scanForm.preset_endpoint || '-'}</span>
                </p>
                <p>
                  API Key: <span className="font-semibold text-blue-600">{scanForm.preset_api_key ? '*** 설정됨' : '-'}</span>
                </p>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                    Headers (JSON)
                  </label>
                  <textarea
                    name="preset_headers"
                    value={scanForm.preset_headers}
                    onChange={onChange}
                    rows={4}
                    placeholder='{"X-Org-Id": "security-team"}'
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </>
            )}
          </div>
          <p className={`mt-auto text-sm leading-5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Advanced Off로도 바로 사용할 수 있고, On으로 옵션 정보를 저장할 수 있습니다.
          </p>
        </div>
      </div>
    </>
  );
}

export default PresetConfigPanel;
