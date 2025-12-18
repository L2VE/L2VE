const SCAN_EMPTY_STATE_META = {
  completed: {
    title: '취약점 없음',
    subtitle: '안전한 상태입니다',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    light: {
      iconWrapper: 'bg-emerald-50',
      icon: 'text-emerald-600',
      title: 'text-emerald-700',
      subtitle: 'text-emerald-500',
      container: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    dark: {
      iconWrapper: 'bg-emerald-500/20 border border-emerald-400/40',
      icon: 'text-emerald-200',
      title: 'text-emerald-200',
      subtitle: 'text-emerald-300',
      container: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200',
    },
  },
  running: {
    title: '스캔이 진행 중입니다',
    subtitle: '결과가 생성되면 자동으로 표시됩니다',
    iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    light: {
      iconWrapper: 'bg-blue-50',
      icon: 'text-blue-600',
      title: 'text-blue-700',
      subtitle: 'text-blue-500',
      container: 'bg-blue-50 border-blue-200 text-blue-700',
    },
    dark: {
      iconWrapper: 'bg-blue-500/20 border border-blue-400/40',
      icon: 'text-blue-100',
      title: 'text-blue-100',
      subtitle: 'text-blue-200',
      container: 'bg-blue-500/15 border-blue-400/40 text-blue-200',
    },
  },
  failed: {
    title: '스캔이 실패했습니다',
    subtitle: '파이프라인 로그를 확인하고 다시 시도해주세요',
    iconPath: 'M10 10l4 4m0-4l-4 4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    light: {
      iconWrapper: 'bg-rose-50',
      icon: 'text-rose-600',
      title: 'text-rose-700',
      subtitle: 'text-rose-500',
      container: 'bg-rose-50 border-rose-200 text-rose-700',
    },
    dark: {
      iconWrapper: 'bg-rose-500/20 border border-rose-400/40',
      icon: 'text-rose-100',
      title: 'text-rose-100',
      subtitle: 'text-rose-200',
      container: 'bg-rose-500/15 border-rose-400/40 text-rose-200',
    },
  },
  queued: {
    title: '스캔이 대기 중입니다',
    subtitle: '잠시 후 자동으로 시작됩니다',
    iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    light: {
      iconWrapper: 'bg-amber-50',
      icon: 'text-amber-600',
      title: 'text-amber-700',
      subtitle: 'text-amber-500',
      container: 'bg-amber-50 border-amber-200 text-amber-700',
    },
    dark: {
      iconWrapper: 'bg-amber-500/20 border border-amber-400/40',
      icon: 'text-amber-100',
      title: 'text-amber-100',
      subtitle: 'text-amber-200',
      container: 'bg-amber-500/15 border-amber-400/40 text-amber-200',
    },
  },
  default: {
    title: '스캔 상태를 확인하는 중입니다',
    subtitle: '잠시 후 다시 시도해주세요',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    light: {
      iconWrapper: 'bg-gray-100',
      icon: 'text-gray-600',
      title: 'text-gray-700',
      subtitle: 'text-gray-500',
      container: 'bg-gray-100 border-gray-200 text-gray-700',
    },
    dark: {
      iconWrapper: 'bg-slate-700/50 border border-slate-600/60',
      icon: 'text-slate-200',
      title: 'text-slate-200',
      subtitle: 'text-slate-400',
      container: 'bg-slate-800/60 border-slate-600/60 text-slate-200',
    },
  },
};

export function getScanEmptyStateMeta(status) {
  const normalized = (status || '').toLowerCase();
  return SCAN_EMPTY_STATE_META[normalized] || SCAN_EMPTY_STATE_META.default;
}
