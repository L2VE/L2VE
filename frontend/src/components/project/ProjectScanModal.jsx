import React, { useEffect, useRef, useState } from 'react';
import scanService from '../../services/scanService';
import ScanModalHeader from './scanModal/ScanModalHeader';
import ScanSourceSection from './scanModal/ScanSourceSection';
import ScanModeTabs from './scanModal/ScanModeTabs';
import PresetConfigPanel from './scanModal/PresetConfigPanel';
import CustomConfigPanel from './scanModal/CustomConfigPanel';
import ScanProgressPanel from './scanModal/ScanProgressPanel';
import ScanMessageBanner from './scanModal/ScanMessageBanner';
import ScanFooter from './scanModal/ScanFooter';

const OPENROUTER_PROVIDER = 'openrouter';
const DIRECT_MODEL_INPUT_VALUE = '__direct_model_input__';
const DIRECT_MODEL_INPUT_OPTION = {
  value: DIRECT_MODEL_INPUT_VALUE,
  label: '직접 입력',
};
const DIRECT_MODEL_PLACEHOLDER = '예: provider/model-name-or-id';
const OPENAI_COMPATIBLE_VALUE = 'compatible';
const OPENAI_COMPATIBLE_LABEL = 'OpenAI Compatible';

const providerCatalog = [
  {
    value: 'openrouter',
    label: 'OpenRouter',
    models: [
      { value: 'x-ai/grok-4.1-fast', label: 'xAI: Grok 4.1 Fast' },
      { value: 'qwen/qwen3-vl-30b-a3b-instruct', label: 'Qwen: Qwen3 VL 30B A3B Instruct' },
      { value: 'qwen/qwen3-vl-235b-a22b-instruct', label: 'Qwen: Qwen3 VL 235B A22B Instruct' },
      { value: 'z-ai/glm-4.6', label: 'Z.AI: GLM 4.6' },
    ],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: [
      { value: 'gpt-5.1', label: 'GPT-5.1' },
      { value: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' },
      { value: 'gpt-5', label: 'GPT-5' },
      { value: 'gpt-5-codex', label: 'GPT-5 Codex' },
      { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
      { value: 'gpt-5-nano', label: 'GPT-5 Nano' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4', label: 'GPT-4' },
    ],
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: [
      { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude 4.5 Haiku' },
    ],
  },
  {
    value: 'google',
    label: 'Google (Vertex AI)',
    models: [
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
      { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    ],
  },
  {
    value: 'bedrock',
    label: 'AWS Bedrock',
    models: [
      { value: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude 4.5 Sonnet' },
      { value: 'global.anthropic.claude-haiku-4-5-20250929-v1:0', label: 'Claude 4.5 Haiku' },
      { value: 'global.amazon.nova-2-lite-v1:0', label: 'Nova 2 Lite' },
    ],
  },
  {
    value: 'groq',
    label: 'Groq',
    models: [
      { value: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
      { value: 'qwen/qwen3-14b', label: 'Qwen 3 14B' },
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
      { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32K' },
    ],
  },
];

const quickProviders = providerCatalog.map(({ value, label }) => ({ value, label }));

const quickModelsByProvider = providerCatalog.reduce((acc, provider) => {
  acc[provider.value] = provider.models;
  return acc;
}, {});

const allModelOptions = providerCatalog.flatMap((provider) => provider.models);

const scanTypeOptions = ['ALL', 'SSRF', 'RCE', 'XSS', 'SQLi', 'IDOR', 'PATH_TRAVERSAL', 'AUTH'];

const modeOptions = [
  { value: 'preset', title: 'Quick Scan' },
  { value: 'custom', title: 'Full Scan' },
];

function ProjectScanModal({
  scanForm,
  scanMessage,
  scanSubmitting,
  scanStatus,
  onClose,
  onChange,
  onSubmit,
  isDark = false,
  projectId,
  scanId,
  onPipelineFinished,
}) {
  const [progress, setProgress] = useState(null);
  const fileInputRef = useRef(null);

  // 진행 상황 polling
  useEffect(() => {
    if (!projectId || !scanId) return;

    const pollInterval = setInterval(async () => {
      try {
        const scanData = await scanService.getScan(projectId, scanId);
        const progressData = scanData.scan_results?.progress;
        if (progressData) {
          setProgress(progressData);
        }
        
        // 스캔이 완료되면 polling 중지
        if (scanData.status === 'completed' || scanData.status === 'failed') {
          clearInterval(pollInterval);
          if (onPipelineFinished) {
            onPipelineFinished(scanData.status);
          }
        }
      } catch (err) {
        console.error('Failed to fetch scan progress:', err);
      }
    }, 2000); // 2초마다 polling

    return () => clearInterval(pollInterval);
  }, [projectId, scanId, onPipelineFinished]);

  const mode = scanForm.mode || 'preset';
  const sourceType = scanForm.source_type || 'git';
  const selectedFile = scanForm.upload_file || null;
  const isCustom = mode === 'custom';
  const presetAdvanced = Boolean(scanForm.preset_advanced);
  const customAdvanced = Boolean(scanForm.custom_advanced);
  const presetModelMode = scanForm.preset_model_mode || 'select';
  const customModelMode = scanForm.custom_model_mode || 'select';

  useEffect(() => {
    if (presetAdvanced && scanForm.preset_provider !== OPENAI_COMPATIBLE_VALUE) {
      onChange({ target: { name: 'preset_provider', value: OPENAI_COMPATIBLE_VALUE } });
    }
  }, [presetAdvanced, scanForm.preset_provider, onChange]);

  useEffect(() => {
    if (customAdvanced && scanForm.custom_provider !== OPENAI_COMPATIBLE_VALUE) {
      onChange({ target: { name: 'custom_provider', value: OPENAI_COMPATIBLE_VALUE } });
    }
  }, [customAdvanced, scanForm.custom_provider, onChange]);

  const getBaseModelsForProvider = (provider) => quickProviders.find((item) => item.value === provider)
    ? quickModelsByProvider[provider] || []
    : [];

  const getModelsForProvider = (provider) => {
    const base = getBaseModelsForProvider(provider);
    return [...base, DIRECT_MODEL_INPUT_OPTION];
  };

  const getProviderLabel = (provider) => {
    if (provider === OPENAI_COMPATIBLE_VALUE) {
      return OPENAI_COMPATIBLE_LABEL;
    }
    return quickProviders.find((item) => item.value === provider)?.label || provider || '-';
  };

  const isKnownModelForProvider = (provider, model) =>
    Boolean(model) && getBaseModelsForProvider(provider).some((option) => option.value === model);

  const getStageLabel = (stage) => {
    const stageLabels = {
      queue: '대기중',
      setup: '도구 준비',
      checkout: '소스 코드 다운로드',
      mcp: 'MCP 서버',
      analysis: '보안 분석',
      upload: '결과 업로드',
      retrieve: '결과 수집',
    };
    return stageLabels[stage] || stage;
  };

  const getStageDescription = (stage) => {
    const descriptions = {
      queue: 'Jenkins 대기열에서 작업 시작',
      setup: '분석 도구 및 환경 준비',
      checkout: 'GitHub에서 소스 코드 다운로드',
      mcp: 'MCP 서버 실시간 및 프로젝트 생성',
      analysis: 'LLM 기반 보안 취약점 분석 수행',
      upload: '분석 결과를 백엔드로 업로드',
      retrieve: '결과 파일 수집 및 정리',
    };
    return descriptions[stage] || '진행 중...';
  };

  const getModelLabel = (provider, model) => {
    const matched =
      getModelsForProvider(provider).find((option) => option.value === model) ||
      allModelOptions.find((option) => option.value === model);
    return matched?.label || model || '-';
  };

  const syncModelForProvider = (modelField, providerValue, modeField) => {
    const models = getBaseModelsForProvider(providerValue);
    const currentModel = scanForm[modelField];
    const hasCurrent = models.some((item) => item.value === currentModel);
    const nextModel = hasCurrent ? currentModel : (models[0]?.value || '');
    if (!hasCurrent || nextModel !== currentModel) {
      onChange({ target: { name: modelField, value: nextModel } });
    } else if (!models.length && currentModel) {
      onChange({ target: { name: modelField, value: '' } });
    }
    if (modeField && scanForm[modeField] !== 'select') {
      onChange({ target: { name: modeField, value: 'select' } });
    }
  };

  const handleProviderSelect = (providerField, modelField, modeField) => (event) => {
    const value = event?.target?.value ?? event;
    onChange({ target: { name: providerField, value } });
    syncModelForProvider(modelField, value, modeField);
  };

  const setAdvancedState = (field, enabled, providerField, modelField, modeField) => {
    onChange({ target: { name: field, value: enabled } });

    if (enabled && providerField) {
      onChange({ target: { name: providerField, value: OPENAI_COMPATIBLE_VALUE } });
      return;
    }

    if (!enabled && providerField && modelField) {
      const currentProvider = scanForm[providerField];
      const providerExists = quickProviders.some((item) => item.value === currentProvider);
      const fallbackProvider = providerExists ? currentProvider : quickProviders[0]?.value || '';
      if (!providerExists) {
        onChange({ target: { name: providerField, value: fallbackProvider } });
      }
      syncModelForProvider(modelField, fallbackProvider, modeField);
    }
  };

  const handleModelSelect = (modelField, providerField, modeField) => (event) => {
    const value = event?.target?.value ?? event;
    if (value === DIRECT_MODEL_INPUT_VALUE) {
      if (modeField && scanForm[modeField] !== 'custom') {
        onChange({ target: { name: modeField, value: 'custom' } });
      }
      if (!scanForm[modelField]) {
        onChange({ target: { name: modelField, value: '' } });
      }
      return;
    }

    onChange({ target: { name: modelField, value } });
    if (modeField && scanForm[modeField] !== 'select') {
      onChange({ target: { name: modeField, value: 'select' } });
    }
  };

  const presetModelOptions = getModelsForProvider(scanForm.preset_provider);
  const customModelOptions = getModelsForProvider(scanForm.custom_provider);
  const safePresetModelOptions = presetModelOptions.length ? presetModelOptions : allModelOptions;
  const safeCustomModelOptions = customModelOptions.length ? customModelOptions : allModelOptions;

  const presetModelIsKnown = isKnownModelForProvider(scanForm.preset_provider, scanForm.preset_model);
  const customModelIsKnown = isKnownModelForProvider(scanForm.custom_provider, scanForm.custom_model);
  const presetDirectInputActive =
    presetModelMode === 'custom' || (!presetModelIsKnown && Boolean(scanForm.preset_model));
  const customDirectInputActive =
    customModelMode === 'custom' || (!customModelIsKnown && Boolean(scanForm.custom_model));
  const presetModelSelectValue = presetDirectInputActive ? DIRECT_MODEL_INPUT_VALUE : scanForm.preset_model;
  const customModelSelectValue = customDirectInputActive ? DIRECT_MODEL_INPUT_VALUE : scanForm.custom_model;
  const notifyEnabled = Boolean(scanForm.notify_enabled);
  const notifyEmails = Array.isArray(scanForm.notify_emails) ? scanForm.notify_emails : [];

  const handleModeChange = (value) => {
    onChange({ target: { name: 'mode', value } });

    const discoveryValue = value === 'preset' ? 'off' : 'on';
    if (scanForm.discovery_mode !== discoveryValue) {
      onChange({ target: { name: 'discovery_mode', value: discoveryValue } });
    }

    const verifierValue = value === 'preset' ? 'off' : 'on';
    if (scanForm.verifier_mode !== verifierValue) {
      onChange({ target: { name: 'verifier_mode', value: verifierValue } });
    }
  };

  const inputClass = isDark
    ? 'w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400'
    : 'w-full px-4 py-3 bg-white border border-blue-100 rounded-xl text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-600';

  const selectClass = inputClass;

  const sectionClass = isDark
    ? 'border border-gray-600 bg-gray-900/70 rounded-2xl'
    : 'border border-gray-200 bg-white rounded-2xl';

  const badgeClass = (value) =>
    [
      'flex-1 text-center text-base font-semibold py-3 rounded-xl border transition-all cursor-pointer',
      mode === value
        ? isDark
          ? 'bg-slate-900/80 text-blue-100 border-blue-500 shadow-inner shadow-blue-500/20'
          : 'bg-blue-50 text-blue-800 border-blue-500 shadow-inner shadow-blue-500/10'
        : isDark
          ? 'text-gray-200 border-gray-700 hover:border-gray-600'
          : 'text-gray-600 border-gray-200 hover:border-gray-300',
    ].join(' ');

  const pillClass = (active) =>
    [
      'px-4 py-2 text-sm font-semibold rounded-xl border transition-all',
      active
        ? isDark
          ? 'bg-slate-800/80 border-blue-500 text-blue-100 shadow-inner shadow-blue-500/20'
          : 'bg-blue-50 border-blue-500 text-blue-800 shadow-inner shadow-blue-500/10'
        : isDark
          ? 'text-gray-200 border-gray-700 hover:border-gray-600'
          : 'text-gray-600 border-gray-200 hover:border-gray-300',
    ].join(' ');

  const handleSourceTypeChange = (value) => {
    if (value === sourceType) return;
    onChange({ target: { name: 'source_type', value } });
    if (value === 'git' && selectedFile) {
      onChange({ target: { name: 'upload_file', value: null } });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const messageClass =
    scanMessage && (scanMessage.includes('실패') || scanMessage.includes('필요'))
      ? isDark
        ? 'bg-rose-500/20 text-rose-100 border-[3px] border-rose-400/70'
        : 'bg-red-100 text-red-800 border-[3px] border-red-300'
      : isDark
        ? 'bg-emerald-500/20 text-emerald-100 border-[3px] border-emerald-400/70'
        : 'bg-green-100 text-green-800 border-[3px] border-green-300';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit();
    }
  };

  const handleNotifyToggle = (checked) => {
    onChange({ target: { name: 'notify_enabled', value: checked, type: 'checkbox', checked } });
    if (checked && notifyEmails.length === 0) {
      onChange({ target: { name: 'notify_emails', value: [''] } });
    }
    if (!checked) {
      onChange({ target: { name: 'notify_emails', value: [] } });
    }
  };

  const handleEmailChange = (index, value) => {
    const next = [...notifyEmails];
    next[index] = value;
    onChange({ target: { name: 'notify_emails', value: next } });
  };

  const addEmailField = () => {
    const next = notifyEmails.length ? [...notifyEmails, ''] : ['', ''];
    onChange({ target: { name: 'notify_emails', value: next } });
  };

  const removeEmailField = (index) => {
    const next = notifyEmails.filter((_, i) => i !== index);
    onChange({ target: { name: 'notify_emails', value: next.length ? next : [''] } });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`${isDark ? 'bg-gray-900 text-gray-100 border border-gray-800' : 'bg-white text-gray-900 border border-gray-200'} rounded-2xl shadow-2xl w-full max-w-[1180px] max-h-[90vh] overflow-y-auto`}
      >
        <ScanModalHeader isDark={isDark} onClose={onClose} />

        <div className="px-8 py-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScanSourceSection
              isDark={isDark}
              sourceType={sourceType}
              pillClass={pillClass}
              handleSourceTypeChange={handleSourceTypeChange}
              scanForm={scanForm}
              onChange={onChange}
              inputClass={inputClass}
              fileInputRef={fileInputRef}
              selectedFile={selectedFile}
            />

            <div className="lg:col-span-2" />

            <ScanModeTabs
              isDark={isDark}
              modeOptions={modeOptions}
              mode={mode}
              handleModeChange={handleModeChange}
              badgeClass={badgeClass}
            />

            {mode === 'preset' && (
              <PresetConfigPanel
                isDark={isDark}
                sectionClass={sectionClass}
                inputClass={inputClass}
                selectClass={selectClass}
                pillClass={pillClass}
                presetAdvanced={presetAdvanced}
                scanForm={scanForm}
                onChange={onChange}
                setAdvancedState={setAdvancedState}
                handleProviderSelect={handleProviderSelect}
                quickProviders={quickProviders}
                safePresetModelOptions={safePresetModelOptions}
                getProviderLabel={getProviderLabel}
                getModelLabel={getModelLabel}
                modelSelectValue={presetModelSelectValue}
                onModelSelect={handleModelSelect('preset_model', 'preset_provider', 'preset_model_mode')}
                showCustomModelInput={presetDirectInputActive && !presetAdvanced}
                customModelPlaceholder={DIRECT_MODEL_PLACEHOLDER}
              />
            )}

            {isCustom && (
              <CustomConfigPanel
                isDark={isDark}
                sectionClass={sectionClass}
                inputClass={inputClass}
                selectClass={selectClass}
                pillClass={pillClass}
                customAdvanced={customAdvanced}
                scanForm={scanForm}
                onChange={onChange}
                setAdvancedState={setAdvancedState}
                handleProviderSelect={handleProviderSelect}
                quickProviders={quickProviders}
                safeCustomModelOptions={safeCustomModelOptions}
                getProviderLabel={getProviderLabel}
                getModelLabel={getModelLabel}
                modelSelectValue={customModelSelectValue}
                onModelSelect={handleModelSelect('custom_model', 'custom_provider', 'custom_model_mode')}
                showCustomModelInput={customDirectInputActive && !customAdvanced}
                customModelPlaceholder={DIRECT_MODEL_PLACEHOLDER}
              />
            )}

            { <div className={`lg:col-span-2 ${sectionClass} p-6 flex flex-col gap-4`}>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-base font-semibold">이메일 알림</div>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    스캔 완료/실패 시 이메일로 알림을 보내세요. 입력한 주소로만 발송됩니다.
                  </p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="notify_enabled"
                    checked={notifyEnabled}
                    onChange={(e) => handleNotifyToggle(e.target.checked)}
                    className="h-5 w-5 accent-blue-600 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">{notifyEnabled ? '알림 사용' : '알림 끄기'}</span>
                </label>
              </div>

              {notifyEnabled && (
                <div className="space-y-3">
                  {notifyEmails.map((email, idx) => (
                    <div key={`${idx}-${notifyEmails.length}`} className="flex gap-3 items-center">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(idx, e.target.value)}
                        placeholder="예: security@example.com"
                        className={inputClass}
                        autoComplete="email"
                      />
                      <button
                        type="button"
                        onClick={() => removeEmailField(idx)}
                        className={`shrink-0 h-11 w-11 px-2.5 flex items-center justify-center rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                          isDark
                            ? 'border-gray-700 text-gray-100 bg-gray-800/60 hover:border-rose-400 hover:text-rose-200 hover:bg-rose-500/10'
                            : 'border-gray-200 text-gray-700 bg-white hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        aria-label="이메일 입력란 제거"
                        disabled={notifyEmails.length <= 1}
                      >
                        -
                      </button> 
                    </div>
                  ))}
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={addEmailField}
                      className={`px-4 py-2 text-sm font-semibold rounded-xl border transition ${
                        isDark
                          ? 'border-blue-500 text-blue-100 hover:bg-blue-500/10'
                          : 'border-blue-600 text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      + 이메일 추가
                    </button>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      최대 몇 개든 추가 가능하며, 콤마 없이 각 입력란에 하나씩 입력하세요.
                    </span>
                  </div>
                </div>
              )}
            </div> }

            <ScanProgressPanel
              isDark={isDark}
              scanSubmitting={scanSubmitting}
              progress={progress}
              getStageLabel={getStageLabel}
              getStageDescription={getStageDescription}
            />

            <ScanMessageBanner messageClass={messageClass} scanMessage={scanMessage} />

            <ScanFooter
              isDark={isDark}
              onClose={onClose}
              scanSubmitting={scanSubmitting}
              scanStatus={scanStatus}
            />
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProjectScanModal;
