const numberFormatter = new Intl.NumberFormat('ko-KR');

function formatDuration(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  if (value < 1) return `${(value * 1000).toFixed(0)} ms`;
  if (value < 60) return `${value.toFixed(1)} s`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}분 ${seconds.toFixed(1)}초`;
}

function formatBoolean(value, fallback = 'N/A') {
  if (value === true) return '예';
  if (value === false) return '아니오';
  return fallback;
}

function formatDate(value) {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch (error) {
    return 'N/A';
  }
}

function MetaItem({ label, value, hint, emphasis = false }) {
  if (value === undefined || value === null || value === '') return null;

  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-all ${
        emphasis
          ? 'border-indigo-200 bg-indigo-50/70'
          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
      }`}
    >
      <div
        className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
          emphasis ? 'text-indigo-600' : 'text-gray-500'
        } mb-1`}
      >
        {label}
      </div>
      <div className={`text-sm ${emphasis ? 'text-indigo-900 font-semibold' : 'text-gray-800'}`}>{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

function SectionCard({ title, description, children, tone = 'default' }) {
  const toneClass =
    tone === 'highlight'
      ? 'border-indigo-300 bg-white shadow-[0_10px_30px_-18px_rgba(79,70,229,0.6)]'
      : 'border-gray-200 bg-white shadow-sm';

  return (
    <div className={`rounded-2xl border ${toneClass} p-6 space-y-5`}>
      <div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ScanDetailsPanel({ selected }) {
  const usage = selected?.scan_results?.usage;
  const toolUsage = selected?.scan_results?.tool_usage;
  const model = selected?.scan_results?.model;
  const provider = selected?.scan_results?.provider;
  const reasoningSummary = selected?.scan_results?.reasoning?.summary;
  const toolList = toolUsage?.tools_used
    ? Object.entries(toolUsage.tools_used)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : [];

  return (
    <div className="space-y-6">
      <SectionCard title="스캔 메타데이터" description="기본 정보와 실행 환경 요약입니다.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetaItem label="스캔 ID" value={selected.id} emphasis />
          <MetaItem label="스캔 이름" value={selected.name || 'N/A'} />
          <MetaItem label="스캔 타입" value={selected.scan_type || selected.scan_config?.mode || 'ALL'} />
          <MetaItem label="생성 시간" value={formatDate(selected.created_at)} />
          <MetaItem label="수정 시간" value={formatDate(selected.updated_at)} />
          <MetaItem label="상태" value={selected.status || 'unknown'} />
          <MetaItem label="LLM 제공자" value={provider || selected.scan_config?.api_provider || 'N/A'} />
          <MetaItem label="사용 모델" value={model || selected.scan_config?.model || 'N/A'} />
          <MetaItem
            label="SAST 실행"
            value={formatBoolean(selected.scan_config?.run_sast)}
            hint="Semgrep 정적 분석 실행 여부"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="LLM 토큰 사용량"
        description="Jenkins 로그에서 추출된 호출 리소스 사용 정보입니다."
        tone="highlight"
      >
        {usage ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem label="총 토큰" value={`${numberFormatter.format(usage.total_tokens)} tokens`} emphasis />
            <MetaItem label="프롬프트 토큰" value={`${numberFormatter.format(usage.prompt_tokens)} tokens`} />
            <MetaItem label="결과 토큰" value={`${numberFormatter.format(usage.completion_tokens)} tokens`} />
            <MetaItem label="LLM 처리 시간" value={formatDuration(usage.total_time)} />
          </div>
        ) : (
          <div className="text-sm text-gray-500">토큰 사용량 정보가 없는 스캔입니다.</div>
        )}
      </SectionCard>

      <SectionCard title="도구 사용 내역" description="스캔 중 호출된 MCP 도구 사용 패턴입니다.">
        {toolUsage ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <span className="inline-flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">총 호출</span>
                <span className="text-base font-semibold text-gray-900">{toolUsage.total_calls ?? '-'}</span>
              </span>
              {toolUsage.call_sequence && toolUsage.call_sequence.length > 0 && (
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">체크포인트</span>
                  <span className="text-sm font-medium text-gray-700">
                    {toolUsage.call_sequence
                      .slice(0, 4)
                      .map((step) => step.tool)
                      .join(' → ')}
                    {toolUsage.call_sequence.length > 4 ? ' → …' : ''}
                  </span>
                </span>
              )}
            </div>

            {toolList.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {toolList.map(([toolName, count]) => (
                  <div
                    key={toolName}
                    className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 flex flex-col gap-1 hover:border-gray-300 transition-colors"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 truncate">{toolName}</span>
                    <span className="text-lg font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">도구 호출 내역이 비어 있습니다.</div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500">도구 사용 정보가 없는 스캔입니다.</div>
        )}
      </SectionCard>

      {reasoningSummary && (
        <SectionCard title="LLM 분석 요약" description="모델이 수행한 조사 단계에 대한 요약입니다.">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
            {reasoningSummary}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export default ScanDetailsPanel;
