import { useEffect, useMemo, useRef, useState } from 'react';
import scanService from '../../services/scanService';
import { collectVulnerabilities, normalizePipelineData, sortVulnerabilitiesByOption } from './scanDetailUtils';
import ScanDetailHeader from './ScanDetailHeader';
import ScanDetailTabs from './ScanDetailTabs';
import ScanSummaryPanel from './ScanSummaryPanel';
import ScanPipelinePanel from './ScanPipelinePanel';
import ScanDetailsPanel from './ScanDetailsPanel';
import ScanPatchPanel from './ScanPatchPanel';
import './ScanDetailModal.css';

function ScanDetailModal({ selected, onClose, isDark, projectId, projectName }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [pipelineData, setPipelineData] = useState(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [dbVulnerabilities, setDbVulnerabilities] = useState([]);
  const [dbFetched, setDbFetched] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');
  const [sortOption, setSortOption] = useState('severity');
  const [currentVulnIndex, setCurrentVulnIndex] = useState(null);
  const scrollContainerRef = useRef(null);

  const resolvedProjectTitle = useMemo(() => {
    return (
      projectName ||
      selected?.scan_results?.project ||
      selected?.scan_results?.project_name ||
      ''
    );
  }, [projectName, selected]);

  useEffect(() => {
    setActiveTab('summary');
    setPipelineData(null);
    setPipelineLoading(false);
    setDbVulnerabilities([]);
    setDbFetched(false);
    setDbError('');
    setSortOption('severity');
    setCurrentVulnIndex(null);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selected?.id]);

  useEffect(() => {
    if (!selected || activeTab !== 'pipeline' || pipelineData || pipelineLoading) return;

    const fetchPipeline = async () => {
      try {
        setPipelineLoading(true);
        const data = await scanService.getPipelineLogs(projectId, selected.id);
        setPipelineData(normalizePipelineData(data));
      } catch (error) {
        const errorMsg = error?.response?.data?.detail || error?.message || '파이프라인 로그를 불러오지 못했습니다.';
        setPipelineData(
          normalizePipelineData({
            available: false,
            message: errorMsg,
            stages: [],
            summary: {},
            errors: [],
            warnings: [],
          })
        );
      } finally {
        setPipelineLoading(false);
      }
    };

    fetchPipeline();
  }, [activeTab, pipelineData, pipelineLoading, projectId, selected]);

  useEffect(() => {
    // DB에 정규화/중복 제거된 취약점 조회 (백엔드 Vulnerability 테이블 기준)
    if (!selected?.id || !projectId) return;
    const fetchVulns = async () => {
      try {
        setDbLoading(true);
        setDbError('');
        setDbFetched(false);
        const res = await scanService.getScanVulnerabilities(projectId, selected.id);
        const normalized = (res || []).map((vuln, idx) => {
          let taintFlow = vuln.taint_flow_analysis || vuln.taint_flow;
          if (taintFlow && (!taintFlow.segments || taintFlow.segments.length === 0) && !taintFlow.description && !taintFlow.risk) {
            taintFlow = null;
          }
          return {
            ...vuln,
            originalIndex: idx,
            title: vuln.vulnerability_title || vuln.title || '미지정 취약점',
            vulnerability_title: vuln.vulnerability_title || vuln.title || '미지정 취약점',
            severity: String(vuln.severity || 'medium').toLowerCase(),
            cwe: vuln.cwe || 'N/A',
            file_path: vuln.file_path || 'N/A',
            line_number: vuln.line_number || vuln.line_num || 'N/A',
            description: vuln.description || '',
            taint_flow_analysis: taintFlow,
            proof_of_concept: vuln.proof_of_concept,
            recommendation: vuln.recommendation,
            code_fix_patch: vuln.code_fix_patch,
            status: vuln.status || 'open',
          };
        });
        setDbVulnerabilities(normalized);
        setDbFetched(true);
      } catch (error) {
        setDbError(error?.response?.data?.detail || error?.message || '취약점 데이터를 불러오지 못했습니다.');
        setDbFetched(false);
      } finally {
        setDbLoading(false);
      }
    };

    fetchVulns();
  }, [projectId, selected?.id]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const vulnerabilities = useMemo(() => {
    // DB에서 가져온 정규화/중복제거된 데이터 우선 사용
    if (dbFetched) {
      return dbVulnerabilities;
    }

    // 사용자의 요청대로 /scans/{id}의 scan_results 필드를 직접 사용 (AnalysisResult 테이블 미사용)
    // 1. scan_results.vulnerabilities (새로운 형식 or Raw Parsing)
    // 2. scan_results.structured_result.vulnerabilities (기존 형식)
    let sourceData = selected?.scan_results?.vulnerabilities;

    if (!sourceData && selected?.scan_results?.structured_result?.vulnerabilities) {
      sourceData = selected.scan_results.structured_result.vulnerabilities;
    }

    if (!Array.isArray(sourceData)) return [];

    return sourceData.map((vuln, idx) => {
      const location = vuln.location || {};

      // Taint Flow Normalization
      let taintFlow = vuln.taint_flow_analysis || vuln.taint_flow || vuln.analysis_result?.taint_flow;

      // Normalize object structure { source, sink, propagation: [] } -> segments: []
      if (taintFlow && !taintFlow.segments && (taintFlow.source || taintFlow.sink || taintFlow.propagation)) {
        const segments = [];
        const addSegment = (stage, data) => {
          if (data) {
            segments.push({
              stage,
              ...data,
              description: data.explanation || data.description,
              code_snippet: data.code_snippet
            });
          }
        };

        addSegment('source', taintFlow.source);

        if (Array.isArray(taintFlow.propagation)) {
          taintFlow.propagation.forEach(p => addSegment('propagation', p));
        } else if (taintFlow.propagation) {
          addSegment('propagation', taintFlow.propagation);
        }

        addSegment('sink', taintFlow.sink);

        if (segments.length > 0) {
          taintFlow = { ...taintFlow, segments };
        } else {
          // If essentially empty, mark as null to hide UI
          taintFlow = null;
        }
      } else if (taintFlow && (!taintFlow.segments || taintFlow.segments.length === 0) && !taintFlow.description && !taintFlow.risk) {
        // Empty object case
        taintFlow = null;
      }

      return {
        ...vuln,
        originalIndex: idx,
        // UI 컴포넌트(ScanPatchPanel 등)에서 사용하는 title 필드 보장
        title: vuln.vulnerability_title || vuln.title || '미지정 취약점',
        vulnerability_title: vuln.vulnerability_title || vuln.title || '미지정 취약점',
        severity: String(vuln.severity || 'medium').toLowerCase(),
        cwe: vuln.cwe || location.cwe || 'N/A',
        file_path: vuln.file_path || location.file_path || location.file || 'N/A',
        line_number: vuln.line_num || vuln.line_number || location.line_number || location.line || 'N/A',
        description: vuln.description || '',
        // 객체 필드들은 그대로 패스
        taint_flow_analysis: taintFlow,
        proof_of_concept: vuln.proof_of_concept,
        recommendation: vuln.recommendation,
        code_fix_patch: vuln.code_fix_patch,
        functional_test: vuln.functional_test,
        security_regression_test: vuln.security_regression_test
      };
    });
  }, [dbFetched, dbVulnerabilities, selected]);

  const vulnJumpOptions = useMemo(() => {
    if (!Array.isArray(vulnerabilities)) return [];
    return vulnerabilities.map((v) => ({
      originalIndex: v.originalIndex,
      title: v.vulnerability_title || v.title || '미지정 취약점',
      severity: v.severity || 'medium',
      cwe: v.cwe || 'N/A',
    }));
  }, [vulnerabilities]);

  const sortedJumpOptions = useMemo(() => sortVulnerabilitiesByOption(vulnJumpOptions, sortOption), [vulnJumpOptions, sortOption]);

  const scrollToVuln = (idx) => {
    if (idx === undefined || idx === null) return;
    const targetId = activeTab === 'patch' ? `patch-vuln-${idx}` : `vuln-detail-${idx}`;
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentVulnIndex(idx);
    }
  };

  if (!selected) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className={`scan-detail-surface ${isDark ? 'scan-detail-dark bg-gray-900 text-gray-100 border-gray-700' : 'bg-white text-gray-900 border-gray-200'} rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[92vh] overflow-hidden border min-w-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <ScanDetailHeader
          selected={selected}
          onClose={onClose}
          isDark={isDark}
          sortOption={sortOption}
          onSortChange={setSortOption}
          vulnerabilities={sortedJumpOptions}
          currentVulnIndex={currentVulnIndex}
          onJumpToVuln={scrollToVuln}
        />
        <ScanDetailTabs activeTab={activeTab} onChange={setActiveTab} isDark={isDark} />

        <div
          ref={scrollContainerRef}
          className="px-8 py-6 overflow-y-auto overflow-x-hidden max-h-[calc(92vh-150px)] scroll-smooth"
        >
          {dbLoading && (
            <div className="mb-4 text-xs text-indigo-500">
              취약점 상세 데이터를 불러오는 중입니다...
            </div>
          )}
          {!dbLoading && dbError && (
            <div className="mb-4 text-xs text-rose-500">
              {dbError}
            </div>
          )}
          {activeTab === 'summary' && (
            <ScanSummaryPanel
              selected={selected}
              vulnerabilities={vulnerabilities}
              isDark={isDark}
              sortOption={sortOption}
              onSortOptionChange={setSortOption}
              onVisibleChange={setCurrentVulnIndex}
              scrollContainerRef={scrollContainerRef}
            />
          )}

          {activeTab === 'patch' && (
            <ScanPatchPanel
              vulnerabilities={vulnerabilities}
              isDark={isDark}
              sortOption={sortOption}
              onVisibleChange={setCurrentVulnIndex}
              scrollContainerRef={scrollContainerRef}
            />
          )}

          {activeTab === 'pipeline' && (
            <ScanPipelinePanel pipelineData={pipelineData} pipelineLoading={pipelineLoading} isDark={isDark} />
          )}

          {activeTab === 'details' && <ScanDetailsPanel selected={selected} isDark={isDark} />}
        </div>
      </div>
    </div>
  );
}

export default ScanDetailModal;
