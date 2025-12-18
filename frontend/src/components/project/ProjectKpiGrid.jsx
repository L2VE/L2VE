import React from 'react';
import { useTheme } from '../../hooks/useTheme';

function ProjectKpiGrid({ stats }) {
  const { isDark } = useTheme();

  const kpis = [
    {
      label: '전체 스캔',
      value: stats.total_scans,
      light: {
        border: 'border-indigo-300',
        background: 'bg-white',
        hover: 'hover:border-indigo-400',
        iconBg: 'bg-indigo-50',
        iconBorder: 'border-indigo-200',
        iconColor: 'text-indigo-600',
      },
      dark: {
        border: 'border-gray-700',
        background: 'bg-gray-800/50',
        hover: 'hover:border-gray-600',
        iconBg: 'bg-indigo-500/20',
        iconBorder: 'border-indigo-500/30',
        iconColor: 'text-indigo-300',
      },
    },
    {
      label: '전체 이슈',
      value: stats.total_vulnerabilities,
      light: {
        border: 'border-amber-300',
        background: 'bg-white',
        hover: 'hover:border-amber-400',
        iconBg: 'bg-amber-50',
        iconBorder: 'border-amber-200',
        iconColor: 'text-amber-600',
      },
      dark: {
        border: 'border-gray-700',
        background: 'bg-gray-800/50',
        hover: 'hover:border-gray-600',
        iconBg: 'bg-amber-500/20',
        iconBorder: 'border-amber-500/30',
        iconColor: 'text-amber-300',
      },
    },
    {
      label: '위험',
      value: stats.critical,
      light: {
        border: 'border-rose-300',
        background: 'bg-white',
        hover: 'hover:border-rose-400',
        iconBg: 'bg-rose-50',
        iconBorder: 'border-rose-200',
        iconColor: 'text-rose-600',
      },
      dark: {
        border: 'border-gray-700',
        background: 'bg-gray-800/50',
        hover: 'hover:border-gray-600',
        iconBg: 'bg-rose-500/20',
        iconBorder: 'border-rose-500/30',
        iconColor: 'text-rose-300',
      },
    },
    {
      label: '높음',
      value: stats.high,
      light: {
        border: 'border-orange-300',
        background: 'bg-white',
        hover: 'hover:border-orange-400',
        iconBg: 'bg-orange-50',
        iconBorder: 'border-orange-200',
        iconColor: 'text-orange-600',
      },
      dark: {
        border: 'border-gray-700',
        background: 'bg-gray-800/50',
        hover: 'hover:border-gray-600',
        iconBg: 'bg-orange-500/20',
        iconBorder: 'border-orange-500/30',
        iconColor: 'text-orange-300',
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      {kpis.map((kpi) => {
        const palette = isDark ? kpi.dark : kpi.light;
        return (
          <div
            key={kpi.label}
            className={`${palette.background} border ${palette.border} rounded-2xl p-6 ${palette.hover} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider font-semibold mb-2`}>{kpi.label}</p>
                <p className={`text-4xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{kpi.value}</p>
              </div>
              <div className={`w-12 h-12 ${palette.iconBg} border ${palette.iconBorder} rounded-xl flex items-center justify-center`}>
                <svg className={`w-6 h-6 ${palette.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ProjectKpiGrid;
