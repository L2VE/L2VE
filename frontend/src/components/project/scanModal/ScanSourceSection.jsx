import React from 'react';

function ScanSourceSection({
  isDark,
  sourceType,
  pillClass,
  handleSourceTypeChange,
  scanForm,
  onChange,
  inputClass,
  fileInputRef,
  selectedFile,
}) {
  return (
    <div className="lg:col-span-2">
      <div
        className={`rounded-2xl px-5 py-4 ${
          isDark ? 'bg-gray-900/70 border border-gray-600/90' : 'bg-white shadow-sm border border-gray-200'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest font-semibold text-gray-700">스캔 소스</p>
            <h3 className="mt-1 text-base font-bold text-blue-800 dark:text-blue-300">분석할 프로젝트 선택</h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Git 레포지토리 URL을 입력하거나 압축 파일을 업로드해 스캔을 수행합니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 ${
                isDark ? 'bg-gray-900/60 border border-gray-600' : 'bg-gray-50 border border-gray-200'
              } rounded-2xl px-1 py-1`}
            >
              <button
                type="button"
                className={`${pillClass(sourceType === 'git')} min-w-[96px] py-2`}
                onClick={() => handleSourceTypeChange('git')}
              >
                Git 레포지토리
              </button>
              <button
                type="button"
                className={`${pillClass(sourceType === 'upload')} min-w-[96px] py-2`}
                onClick={() => handleSourceTypeChange('upload')}
              >
                파일 업로드
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          {sourceType === 'git' ? (
            <div className="grid gap-3">
              <label className="text-sm font-bold text-blue-800 dark:text-blue-300">Git Repository URL</label>
              <input
                type="text"
                name="github_url"
                value={scanForm.github_url}
                onChange={onChange}
                placeholder="https://github.com/org/repo.git"
                className={inputClass}
              />
            </div>
          ) : (
            <div className="grid gap-3">
              <label className="text-sm font-bold text-blue-800 dark:text-blue-300">프로젝트 압축 파일</label>
              <input
                ref={fileInputRef}
                id="scan-upload-input"
                type="file"
                name="upload_file"
                accept=".zip,.tar,.tar.gz,.tgz,.tar.bz2"
                onChange={onChange}
                className="sr-only"
              />
              <label
                htmlFor="scan-upload-input"
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-dashed px-5 py-6 cursor-pointer transition-colors ${
                  isDark
                    ? 'border-gray-600 bg-gray-900/40 hover:border-gray-500 hover:bg-gray-900/60'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${
                      isDark ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16.5V21h16v-4.5M12 3v12m0-12L8 7m4-4 4 4" />
                    </svg>
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedFile ? selectedFile.name : '여기를 클릭해 파일을 선택하세요'}</p>
                    {selectedFile && (
                      <p className={`text-sm mt-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>새 파일을 선택하면 기존 파일이 대체됩니다</p>
                    )}
                  </div>
                </div>
                <div className="text-sm text-blue-600 font-medium sm:text-right">
                  {selectedFile && selectedFile.size && selectedFile.size > 0
                    ? (() => {
                        const sizeInMB = selectedFile.size / (1024 * 1024);
                        const sizeInKB = selectedFile.size / 1024;
                        if (sizeInMB >= 1) {
                          return `${sizeInMB.toFixed(1)} MB`;
                        } else if (sizeInKB >= 1) {
                          return `${sizeInKB.toFixed(1)} KB`;
                        } else {
                          return `${selectedFile.size} bytes`;
                        }
                      })()
                    : selectedFile
                      ? '파일 크기 확인 중...'
                      : '선택 후 자동 업로드 준비'}
                </div>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScanSourceSection;


