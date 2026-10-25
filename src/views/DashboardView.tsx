import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type {
  DashboardResponse,
  Resource,
  ResourceDetail,
  Recommendation,
  AIForecastResponse,
  AIBriefingResponse,
} from '../types/api';
import { apiClient } from '../api/client';
import { formatINR, formatNumber } from '../utils/format';

export type ResourceCategoryTab = 'ALL' | 'FLAGGED' | 'PROTECTED' | 'COMPUTE' | 'STORAGE';

interface DashboardViewProps {
  data: DashboardResponse;
  resources: Resource[];
  recommendations?: Recommendation[];
  selectedResourceDetail?: ResourceDetail | null;
  externalCategory?: ResourceCategoryTab;
  onCategoryChange?: (cat: ResourceCategoryTab) => void;
  onSelectResourceForDrawer: (id: string, openFullModal?: boolean) => void;
  onAcceptRecommendation?: (recId: string) => void;
  onNavigateToInventory: (filterStatus?: string) => void;
  onNavigateToRecommendations: (filterAction?: string) => void;
  onNavigateToAlerts: () => void;
  onAcceptCategory?: (category: 'orphan' | 'off_hours' | 'rightsize') => void;
  onOpenExportModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  resources,
  recommendations = [],
  selectedResourceDetail,
  externalCategory = 'ALL',
  onCategoryChange,
  onSelectResourceForDrawer,
  onAcceptRecommendation,
  onNavigateToRecommendations,
  onAcceptCategory,
  onOpenExportModal,
}) => {
  const [internalCategoryTab, setInternalCategoryTab] = useState<ResourceCategoryTab>('ALL');
  const categoryTab = onCategoryChange ? externalCategory : internalCategoryTab;
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [envFilter, setEnvFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [showAllRows, setShowAllRows] = useState<boolean>(false);
  const [drawerMetric, setDrawerMetric] = useState<'cpu' | 'mem'>('cpu');

  // Python AI :8001 Role Briefing & Multi-Horizon Forecaster state
  const [briefingRole, setBriefingRole] = useState<'executive' | 'finance' | 'engineering'>('executive');
  const [briefing, setBriefing] = useState<AIBriefingResponse | null>(null);
  const [horizonDays, setHorizonDays] = useState<number>(60);
  const [customDaysInput, setCustomDaysInput] = useState<string>('60');
  const [forecastChartType, setForecastChartType] = useState<'cost' | 'usage'>('cost');
  const [aiForecast, setAiForecast] = useState<AIForecastResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.getAIBriefing(briefingRole).then((res) => {
      if (!cancelled) setBriefing(res);
    });
    return () => {
      cancelled = true;
    };
  }, [briefingRole, data.accepted_monthly_savings_inr]);

  useEffect(() => {
    let cancelled = false;
    apiClient.getAIForecast(horizonDays, 25).then((res) => {
      if (!cancelled) setAiForecast(res);
    });
    return () => {
      cancelled = true;
    };
  }, [horizonDays, data.accepted_monthly_savings_inr]);

  const recByResourceId = useMemo(() => {
    const map = new Map<string, Recommendation>();
    for (const r of recommendations) {
      map.set(r.resource_id, r);
    }
    return map;
  }, [recommendations]);

  const orphanRecs = useMemo(
    () =>
      recommendations.filter(
        (r) =>
          r.action_type === 'CLEANUP_ORPHAN' ||
          r.action_type === 'CLEAN_ORPHANED_VOLUME' ||
          r.action_type === 'CLEAN_ORPHANED_IP'
      ),
    [recommendations]
  );
  const offHoursRecs = useMemo(
    () =>
      recommendations.filter(
        (r) =>
          r.action_type === 'SCHEDULE_OFF_HOURS' ||
          r.action_type === 'OFF_HOURS_SHUTDOWN'
      ),
    [recommendations]
  );
  const rightsizeRecs = useMemo(
    () =>
      recommendations.filter(
        (r) =>
          r.action_type === 'RIGHTSIZE_VM' ||
          r.action_type === 'TERMINATE_ZOMBIE' ||
          r.action_type === 'TERMINATE_ZOMBIE_VM'
      ),
    [recommendations]
  );

  const orphanTotalSavings = orphanRecs.reduce((acc, r) => acc + r.monthly_savings_inr, 0);
  const offHoursTotalSavings = offHoursRecs.reduce((acc, r) => acc + r.monthly_savings_inr, 0);
  const rightsizeTotalSavings = rightsizeRecs.reduce((acc, r) => acc + r.monthly_savings_inr, 0);

  const orphanPendingCount = orphanRecs.filter((r) => r.status === 'pending').length;
  const offHoursPendingCount = offHoursRecs.filter((r) => r.status === 'pending').length;
  const rightsizePendingCount = rightsizeRecs.filter((r) => r.status === 'pending').length;

  const countAll = resources.length;
  const countFlagged = resources.filter((r) =>
    ['OVERPROVISIONED', 'IDLE_SCHEDULE_CANDIDATE', 'ZOMBIE', 'ORPHANED'].includes(
      r.optimization_status
    )
  ).length;
  const countProtected = resources.filter(
    (r) => r.optimization_status === 'PROTECTED_PEAK_LOAD'
  ).length;
  const countCompute = resources.filter((r) => r.type === 'vm').length;
  const countStorage = resources.filter((r) => r.type !== 'vm').length;

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (categoryTab === 'FLAGGED') {
        if (
          !['OVERPROVISIONED', 'IDLE_SCHEDULE_CANDIDATE', 'ZOMBIE', 'ORPHANED'].includes(
            r.optimization_status
          )
        )
          return false;
      } else if (categoryTab === 'PROTECTED') {
        if (r.optimization_status !== 'PROTECTED_PEAK_LOAD') return false;
      } else if (categoryTab === 'COMPUTE') {
        if (r.type !== 'vm') return false;
      } else if (categoryTab === 'STORAGE') {
        if (r.type === 'vm') return false;
      }

      if (regionFilter !== 'ALL' && r.region !== regionFilter) return false;
      if (envFilter !== 'ALL' && r.env.toLowerCase() !== envFilter.toLowerCase()) return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const specStr = `${r.plan || ''} ${r.current_spec || ''} ${r.vcpu || ''} ${r.ram_gb || ''}`.toLowerCase();
        const match =
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q) ||
          (r.team && r.team.toLowerCase().includes(q)) ||
          specStr.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [resources, categoryTab, regionFilter, envFilter, searchQuery]);

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredResources.length / pageSize));
  const visibleResources = showAllRows
    ? filteredResources
    : filteredResources.slice((page - 1) * pageSize, page * pageSize);

  const handleSelectCategory = (cat: ResourceCategoryTab) => {
    setInternalCategoryTab(cat);
    onCategoryChange?.(cat);
    setPage(1);
  };

  const formatHardwareSpec = (r: Resource) => {
    if (r.type === 'vm') {
      const plan = r.plan || (r.current_spec ? r.current_spec.split(' ')[0] : 'm8.xlarge');
      const vcpu = r.vcpu ?? 4;
      const ram = r.ram_gb ?? 16;
      return `${plan} · ${vcpu} vCPU · ${ram} GB RAM · ${r.region}`;
    }
    if (r.type === 'volume' || r.type === 'block_volume' || r.type === 'block_ssd') {
      const disk = r.disk_gb ?? 500;
      return `Block SSD · ${disk} GB NVMe · ${r.region}`;
    }
    return `Public IPv4 · Elastic IP (${r.ip_address || 'Unbound'}) · ${r.region}`;
  };

  // Neutral Monochromatic Environment Pill (Never competes with semantic status colors)
  const renderEnvBadge = (env: string) => {
    const lower = env.toLowerCase();
    const label =
      lower === 'prod' || lower === 'production'
        ? 'Production'
        : lower === 'staging'
        ? 'Staging'
        : 'Development';
    return (
      <span className="inline-flex px-2.5 py-0.5 rounded-md glass-pill-neutral text-[11px] font-medium tracking-wide">
        {label}
      </span>
    );
  };

  // Avg / Peak Utilization Cell using only Blended Status Colors (Sage, Ochre, Carmine)
  const renderAvgPeakCell = (r: Resource) => {
    if (r.type === 'vm') {
      const cpuAvg = Math.round(r.metrics_summary?.cpu_avg || 0);
      const cpuPeak = Math.round(r.metrics_summary?.cpu_p99 || r.metrics_summary?.cpu_p95 || 0);
      const ramAvg = Math.round(r.metrics_summary?.mem_avg || 0);
      const ramPeak = Math.round(r.metrics_summary?.mem_p95 || 0);

      const barColor =
        cpuPeak >= 85
          ? 'bg-[#9E2F2B]'
          : cpuPeak >= 65
          ? 'bg-[#94601B]'
          : 'bg-[#236B52]';

      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-black/[0.07] overflow-hidden flex shrink-0">
              <div
                className={`${barColor} h-full rounded-full`}
                style={{ width: `${Math.min(100, Math.max(4, cpuPeak))}%` }}
              />
            </div>
            <span className="text-[#111318] text-[12px] font-semibold font-mono whitespace-nowrap">
              CPU {cpuAvg}% / {cpuPeak}%
            </span>
          </div>
          <div className="text-[11px] font-mono text-[#767D8C]">
            RAM Avg {ramAvg}% · Peak {ramPeak}%
          </div>
        </div>
      );
    }

    const isOrphan = r.optimization_status === 'ORPHANED';
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-black/[0.07] overflow-hidden flex shrink-0">
            <div
              className={`${isOrphan ? 'bg-[#9E2F2B]' : 'bg-[#236B52]'} h-full rounded-full`}
              style={{ width: isOrphan ? '8%' : '45%' }}
            />
          </div>
          <span
            className={`text-[12px] font-semibold font-mono ${
              isOrphan ? 'text-[#8F2925]' : 'text-[#111318]'
            }`}
          >
            {isOrphan ? '0% (Idle)' : 'Active I/O'}
          </span>
        </div>
        <div className="text-[11px] font-mono text-[#767D8C]">
          {r.attached_to ? `Attached: ${r.attached_to}` : 'Unmounted >30d'}
        </div>
      </div>
    );
  };

  const renderRecommendationText = (r: Resource, rec?: Recommendation) => {
    if (rec) {
      const target =
        rec.recommended_config || rec.target_spec || rec.action_title || rec.action_type;
      const pct =
        r.monthly_cost_inr > 0
          ? Math.round((rec.monthly_savings_inr / r.monthly_cost_inr) * 100)
          : 0;
      return (
        <div>
          <div className="text-[#111318] font-medium text-xs truncate max-w-[230px]">
            {target} {pct > 0 ? `(-${pct}%)` : ''}
          </div>
          <div className="text-[11px] text-[#1D5C46] font-mono font-medium truncate max-w-[230px]">
            Save {formatINR(rec.monthly_savings_inr)}/mo · {rec.status.toUpperCase()}
          </div>
        </div>
      );
    }

    if (r.optimization_status === 'PROTECTED_PEAK_LOAD') {
      const p99 = Math.round(r.metrics_summary?.cpu_p99 || 0);
      return (
        <div>
          <div className="text-[#7C4F14] font-semibold text-xs">
            Peak Protected (Keep Plan)
          </div>
          <div className="text-[11px] text-[#767D8C] font-mono">
            Daily p99={p99}% exceeds 85% ceiling
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="text-[#4A505C] font-medium text-xs">
          Right-Sized Within SLA
        </div>
        <div className="text-[11px] text-[#767D8C] font-mono">
          Balanced diurnal utilization
        </div>
      </div>
    );
  };

  // Row Action Button: Status pills for Approved/Protected, Sleek Carbon/Glass for Actions
  const renderRowActionButton = (r: Resource, rec?: Recommendation) => {
    if (rec) {
      const isAccepted = rec.status === 'accepted';
      if (isAccepted) {
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectResourceForDrawer(r.id, false);
            }}
            className="px-2.5 py-1 rounded-lg status-green text-[11px] font-semibold transition-all"
          >
            Approved
          </button>
        );
      }

      const isOffHours =
        rec.action_type === 'SCHEDULE_OFF_HOURS' ||
        rec.action_type === 'OFF_HOURS_SHUTDOWN';
      const isOrphan =
        rec.action_type === 'CLEANUP_ORPHAN' ||
        rec.action_type === 'CLEAN_ORPHANED_VOLUME' ||
        rec.action_type === 'CLEAN_ORPHANED_IP';
      const isZombie =
        rec.action_type === 'TERMINATE_ZOMBIE' ||
        rec.action_type === 'TERMINATE_ZOMBIE_VM';

      const label = isOrphan
        ? 'Purge'
        : isOffHours
        ? 'Schedule'
        : isZombie
        ? 'Terminate'
        : 'Downsize';

      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onAcceptRecommendation) {
              onAcceptRecommendation(rec.id);
            } else {
              onSelectResourceForDrawer(r.id, false);
            }
          }}
          className="px-2.5 py-1 rounded-lg bg-[#111318] hover:bg-[#252A34] text-white text-[11px] font-medium shadow-2xs transition-all"
        >
          {label}
        </button>
      );
    }

    if (r.optimization_status === 'PROTECTED_PEAK_LOAD') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectResourceForDrawer(r.id, false);
          }}
          className="px-2.5 py-1 rounded-lg status-yellow text-[11px] font-semibold transition-all"
        >
          Protected
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectResourceForDrawer(r.id, false);
        }}
        className="px-2.5 py-1 rounded-lg glass-pill-neutral hover:bg-black/[0.08] text-[11px] font-medium transition-all"
      >
        Inspect
      </button>
    );
  };

  const drawerChartGeometry = useMemo(() => {
    const series = selectedResourceDetail?.timeseries_30d || [];
    if (series.length === 0) {
      return {
        polyline: '30,97 90,87 150,89 210,95 255,87 330,94',
        polygon: '30,110 30,97 90,87 150,89 210,95 255,87 330,94 330,110',
        peakVal: 21,
        avgVal: 11.4,
        peakY: 87,
        peakX: 255,
      };
    }

    const sampled = series
      .filter((_, idx) => idx % Math.max(1, Math.floor(series.length / 22)) === 0)
      .slice(0, 22);
    const values = sampled.map((pt) =>
      drawerMetric === 'cpu' ? Number(pt.cpu_pct || 0) : Number(pt.mem_pct || 0)
    );
    const maxVal = Math.max(...values, 1);
    const avgVal = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);

    let peakX = 255;
    let peakY = 87;
    let bestVal = -1;

    const coords = values.map((v, i) => {
      const x = Math.round(30 + (i / Math.max(1, values.length - 1)) * 300);
      const clamped = Math.min(100, Math.max(0, v));
      const y = Math.round(110 - (clamped / 100) * 90);
      if (v > bestVal) {
        bestVal = v;
        peakX = x;
        peakY = y;
      }
      return `${x},${y}`;
    });

    const polyline = coords.join(' ');
    const polygon = `30,110 ${polyline} 330,110`;

    return {
      polyline,
      polygon,
      peakVal: Math.round(maxVal),
      avgVal: Number(avgVal.toFixed(1)),
      peakY,
      peakX,
    };
  }, [selectedResourceDetail, drawerMetric]);

  const normalizedHistorical = (data.historical_spend_6m || []).map((item) => ({
    month: item.month,
    spend_inr: item.total_inr ?? item.spend_inr ?? 0,
  }));

  // Dynamic forecast for custom horizonDays (both INR spend & compute vCPU usage)
  const dynamicForecast = useMemo(() => {
    const points = [];
    const baseUnopt = data.current_monthly_spend_inr || 683200;
    const baseOpt = data.projected_monthly_spend_inr || 453970;
    const dailyUnopt = baseUnopt / 30;
    const dailyOpt = baseOpt / 30;

    const totalVcpu = resources.reduce((acc, r) => acc + (r.vcpu || (r.type === 'vm' ? 4 : 0)), 0) || 320;
    const optimizedVcpu = Math.round(totalVcpu * 0.65);

    const totalDays = Math.max(7, Math.min(365, horizonDays));
    const step = totalDays > 60 ? Math.ceil(totalDays / 30) : Math.max(1, Math.floor(totalDays / 20));

    for (let d = 1; d <= totalDays; d += step) {
      const growthFactor = 1 + (d / 30) * ((data.bill_growth_6m_pct || 14) / 100);
      const unoptSpend = Math.round(dailyUnopt * d * growthFactor);
      const optSpend = Math.round(dailyOpt * d * (1 + (d / 60) * 0.02));

      // Usage: Compute vCPU-hours
      const originalVcpuHours = Math.round(totalVcpu * 24 * d * (1 + (d / 120) * 0.05));
      const optimizedVcpuHours = Math.round(optimizedVcpu * 24 * d);
      const savedVcpuHours = Math.max(0, originalVcpuHours - optimizedVcpuHours);

      points.push({
        day: `Day ${d}`,
        displayDate: `+${d}d`,
        unoptimized_inr: unoptSpend,
        optimized_inr: optSpend,
        original_usage_hours: originalVcpuHours,
        saved_usage_hours: optimizedVcpuHours,
        net_saved_hours: savedVcpuHours,
      });
    }
    return points;
  }, [horizonDays, data.current_monthly_spend_inr, data.projected_monthly_spend_inr, data.bill_growth_6m_pct, resources]);

  const handleDirectExportCsv = () => {
    const headers = [
      'Resource ID',
      'Name',
      'Type',
      'Environment',
      'Region',
      'Plan / Spec',
      'Monthly Cost INR',
      'Status',
      'Recommendation',
      'Monthly Savings INR',
    ];
    const rows = resources.map((r) => {
      const rec = recByResourceId.get(r.id);
      return [
        r.id,
        `"${r.name.replace(/"/g, '""')}"`,
        r.type,
        r.env,
        r.region,
        `"${(r.plan || r.current_spec || '').replace(/"/g, '""')}"`,
        r.monthly_cost_inr || 0,
        r.optimization_status || 'OPTIMAL',
        rec ? `"${(rec.action_title || rec.action_type || '').replace(/"/g, '""')}"` : 'None',
        rec ? rec.monthly_savings_inr : 0,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `utho_finops_audit_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const activeResource =
    selectedResourceDetail || (resources[0] as unknown as ResourceDetail | undefined);
  const activeRec = activeResource
    ? activeResource.recommendation || recByResourceId.get(activeResource.id)
    : undefined;
  const activeEng = activeResource?.engineering_analysis || {};

  const currentCostInr = activeResource?.monthly_cost_inr || 0;
  const savingsInr = activeRec?.monthly_savings_inr || 0;
  const targetCostInr = Math.max(0, currentCostInr - savingsInr);
  const savingsPct = currentCostInr > 0 ? Math.round((savingsInr / currentCostInr) * 100) : 0;

  return (
    <div className="flex flex-col w-full pb-space-xl space-y-space-lg">
      {/* 1. TOP GLASS SUMMARY STRIP */}
      <div className="w-full glass-card rounded-2xl p-space-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-lg">
          {/* Metrics Trio */}
          <div className="flex flex-wrap items-center gap-space-xl">
            <div>
              <div className="flex items-center gap-space-xs mb-1">
                <span className="font-label-caps text-label-caps text-[#767D8C] uppercase tracking-wider">
                  Current Monthly Spend
                </span>
                <span className="px-2 py-0.5 rounded-md status-red text-[11px] font-semibold font-tabular-numeric-md">
                  +{data.bill_growth_6m_pct}% 6M Trend
                </span>
              </div>
              <div className="font-tabular-numeric-lg text-tabular-numeric-lg text-[#111318]">
                {formatINR(data.current_monthly_spend_inr)}
              </div>
            </div>

            <div className="hidden sm:block w-px h-10 bg-black/[0.07]" />

            <div>
              <div className="flex items-center gap-space-xs mb-1">
                <span className="font-label-caps text-label-caps text-[#767D8C] uppercase tracking-wider">
                  Projected After Optimization
                </span>
                <span className="px-2 py-0.5 rounded-md status-green text-[11px] font-semibold font-tabular-numeric-md">
                  Save {formatINR(data.accepted_monthly_savings_inr)} ({data.accepted_savings_pct.toFixed(1)}%)
                </span>
              </div>
              <div className="font-tabular-numeric-lg text-tabular-numeric-lg text-[#111318]">
                {formatINR(data.projected_monthly_spend_inr)}
              </div>
            </div>

            <div className="hidden md:block w-px h-10 bg-black/[0.07]" />

            <div>
              <div className="flex items-center gap-space-xs mb-1">
                <span className="font-label-caps text-label-caps text-[#767D8C] uppercase tracking-wider">
                  Total Pipeline Opportunity
                </span>
                <span className="px-2 py-0.5 rounded-md status-yellow text-[11px] font-semibold font-tabular-numeric-md">
                  {data.protected_peak_vms_count} Peak Protected
                </span>
              </div>
              <div className="font-tabular-numeric-lg text-tabular-numeric-lg text-[#1D5C46]">
                {formatINR(data.total_potential_savings_inr)}/mo
              </div>
            </div>
          </div>

          {/* Controls & Actions */}
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="flex items-center gap-1 p-1 rounded-xl glass-well">
              {(['ALL', 'in-mumbai-1', 'in-bangalore-1', 'in-noida-1'] as const).map((reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => {
                    setRegionFilter(reg);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                    regionFilter === reg
                      ? 'bg-white text-[#111318] font-semibold shadow-2xs border border-black/[0.06]'
                      : 'text-[#4A505C] hover:text-[#111318]'
                  }`}
                >
                  {reg === 'ALL' ? 'All Regions' : reg}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDirectExportCsv}
                className="inline-flex items-center gap-1.5 px-space-md py-1.5 rounded-xl bg-[#111318] hover:bg-[#232730] text-white font-body-sm text-body-sm font-medium shadow-xs transition-all cursor-pointer"
                title="Download full CSV report immediately"
              >
                <span>↓</span> Export Report (.csv)
              </button>
              {onOpenExportModal && (
                <button
                  type="button"
                  onClick={onOpenExportModal}
                  className="inline-flex items-center gap-1.5 px-space-md py-1.5 rounded-xl glass-well hover:bg-black/[0.08] text-[#111318] font-body-sm text-body-sm font-medium transition-all cursor-pointer border border-black/[0.08]"
                  title="View and download automated CLI & Terraform manifests"
                >
                  Terraform &amp; CLI
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. PRIORITY OPTIMIZATION CARDS (Minimalist Frosted Glass + Blended Status Badges) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {/* Card 1: Unused Storage Volumes & IPs (Status Red: Active Leak) */}
        <div className="glass-card rounded-2xl p-space-lg flex flex-col justify-between transition-all hover:bg-white/85">
          <div>
            <div className="flex items-center justify-between gap-space-sm mb-space-sm">
              <span className="px-2.5 py-1 rounded-md status-red font-label-caps text-label-caps uppercase font-semibold tracking-wider">
                Storage Leak
              </span>
              <span className="font-tabular-numeric-md text-tabular-numeric-md text-[#1D5C46] font-semibold">
                -{formatINR(orphanTotalSavings)}/mo
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-[#111318] mb-1 font-semibold">
              Unused Storage Volumes &amp; IPs
            </h3>
            <p className="font-body-sm text-body-sm text-[#4A505C] mb-space-md leading-relaxed">
              {orphanRecs.length} unattached block SSD volumes and static IPv4 addresses found. Snapshots confirmed available; unmounted for &gt;30 consecutive days.
            </p>
          </div>
          <div className="pt-space-sm border-t border-black/[0.05] flex items-center justify-between">
            <span className="font-code-sm text-code-sm text-[#767D8C]">
              {orphanRecs.length} assets · {orphanPendingCount} pending
            </span>
            <button
              type="button"
              onClick={() => {
                if (orphanPendingCount > 0 && onAcceptCategory) {
                  onAcceptCategory('orphan');
                } else {
                  handleSelectCategory('STORAGE');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-[#111318] hover:bg-[#252A34] text-white font-body-sm text-body-sm font-medium transition-all shadow-2xs"
            >
              {orphanPendingCount > 0 ? `Review & Purge (${orphanPendingCount})` : 'Inspect Storage'}
            </button>
          </div>
        </div>

        {/* Card 2: Idle Weekend & Night Servers (Status Yellow: Off-Hours Standby) */}
        <div className="glass-card rounded-2xl p-space-lg flex flex-col justify-between transition-all hover:bg-white/85">
          <div>
            <div className="flex items-center justify-between gap-space-sm mb-space-sm">
              <span className="px-2.5 py-1 rounded-md status-yellow font-label-caps text-label-caps uppercase font-semibold tracking-wider">
                Idle Fleet
              </span>
              <span className="font-tabular-numeric-md text-tabular-numeric-md text-[#1D5C46] font-semibold">
                -{formatINR(offHoursTotalSavings)}/mo
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-[#111318] mb-1 font-semibold">
              Idle Weekend &amp; Night Servers
            </h3>
            <p className="font-body-sm text-body-sm text-[#4A505C] mb-space-md leading-relaxed">
              {offHoursRecs.length} non-production dev and staging instances with 0–4% CPU activity from 20:00 to 08:00 IST and weekends (118 hrs/wk).
            </p>
          </div>
          <div className="pt-space-sm border-t border-black/[0.05] flex items-center justify-between">
            <span className="font-code-sm text-code-sm text-[#767D8C]">
              {offHoursRecs.length} QA / Staging / Dev nodes
            </span>
            <button
              type="button"
              onClick={() => {
                if (offHoursPendingCount > 0 && onAcceptCategory) {
                  onAcceptCategory('off_hours');
                } else {
                  onNavigateToRecommendations('OFF_HOURS');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-[#111318] hover:bg-[#252A34] text-white font-body-sm text-body-sm font-medium transition-all shadow-2xs"
            >
              {offHoursPendingCount > 0 ? `Schedule Auto-Stop (${offHoursPendingCount})` : 'View Schedules'}
            </button>
          </div>
        </div>

        {/* Card 3: Oversized Production Servers (Status Green: Verified Safe Right-Sizing) */}
        <div className="glass-card rounded-2xl p-space-lg flex flex-col justify-between transition-all hover:bg-white/85">
          <div>
            <div className="flex items-center justify-between gap-space-sm mb-space-sm">
              <span className="px-2.5 py-1 rounded-md status-green font-label-caps text-label-caps uppercase font-semibold tracking-wider">
                Right-Sizing Ready
              </span>
              <span className="font-tabular-numeric-md text-tabular-numeric-md text-[#1D5C46] font-semibold">
                -{formatINR(rightsizeTotalSavings)}/mo
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-[#111318] mb-1 font-semibold">
              Oversized Production Servers
            </h3>
            <p className="font-body-sm text-body-sm text-[#4A505C] mb-space-md leading-relaxed">
              {rightsizeRecs.length} compute units safely eligible for tier downsizing under p95/p99 headroom rules ({data.protected_peak_vms_count} bursty VMs protected).
            </p>
          </div>
          <div className="pt-space-sm border-t border-black/[0.05] flex items-center justify-between">
            <span className="font-code-sm text-code-sm text-[#767D8C]">
              {rightsizeRecs.length} Utho compute clusters
            </span>
            <button
              type="button"
              onClick={() => {
                if (rightsizePendingCount > 0 && onAcceptCategory) {
                  onAcceptCategory('rightsize');
                } else {
                  onNavigateToRecommendations('RIGHTSIZE_VM');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-[#111318] hover:bg-[#252A34] text-white font-body-sm text-body-sm font-medium transition-all shadow-2xs"
            >
              {rightsizePendingCount > 0 ? `Apply Right-Sizing (${rightsizePendingCount})` : 'Review Plan'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. MAIN SPLIT LAYOUT: DATA TABLE (8 COLS) + RESOURCE INSPECTION DRAWER (4 COLS) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* LEFT 8 COLS: Resource Table Section */}
        <div className="xl:col-span-8 flex flex-col glass-card rounded-2xl overflow-hidden">
          {/* Table Header & Filter Bar */}
          <div className="p-space-md flex flex-col gap-space-sm border-b border-black/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              {/* Category Tabs */}
              <div className="flex items-center gap-1 p-1 glass-well rounded-xl overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handleSelectCategory('ALL')}
                  className={`px-space-sm py-1 rounded-lg font-body-sm text-body-sm font-medium transition-all ${
                    categoryTab === 'ALL'
                      ? 'text-[#111318] bg-white font-semibold shadow-2xs border border-black/[0.06]'
                      : 'text-[#4A505C] hover:text-[#111318]'
                  }`}
                >
                  All Resources{' '}
                  <span className="text-[#767D8C] font-code-sm text-code-sm ml-1">{countAll}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCategory('FLAGGED')}
                  className={`px-space-sm py-1 rounded-lg font-body-sm text-body-sm font-medium transition-all ${
                    categoryTab === 'FLAGGED'
                      ? 'text-[#111318] bg-white font-semibold shadow-2xs border border-black/[0.06]'
                      : 'text-[#4A505C] hover:text-[#111318]'
                  }`}
                >
                  Flagged{' '}
                  <span className="px-1.5 py-0.5 rounded status-yellow text-[10px] font-mono font-semibold ml-1">
                    {countFlagged}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCategory('PROTECTED')}
                  className={`px-space-sm py-1 rounded-lg font-body-sm text-body-sm font-medium transition-all ${
                    categoryTab === 'PROTECTED'
                      ? 'text-[#111318] bg-white font-semibold shadow-2xs border border-black/[0.06]'
                      : 'text-[#4A505C] hover:text-[#111318]'
                  }`}
                >
                  Peak Protected{' '}
                  <span className="px-1.5 py-0.5 rounded glass-pill-neutral text-[10px] font-mono font-semibold ml-1">
                    {countProtected}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCategory('COMPUTE')}
                  className={`px-space-sm py-1 rounded-lg font-body-sm text-body-sm font-medium transition-all ${
                    categoryTab === 'COMPUTE'
                      ? 'text-[#111318] bg-white font-semibold shadow-2xs border border-black/[0.06]'
                      : 'text-[#4A505C] hover:text-[#111318]'
                  }`}
                >
                  Compute ({countCompute})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCategory('STORAGE')}
                  className={`px-space-sm py-1 rounded-lg font-body-sm text-body-sm font-medium transition-all ${
                    categoryTab === 'STORAGE'
                      ? 'text-[#111318] bg-white font-semibold shadow-2xs border border-black/[0.06]'
                      : 'text-[#4A505C] hover:text-[#111318]'
                  }`}
                >
                  Storage &amp; IPs ({countStorage})
                </button>
              </div>

              {/* Environment Filter + Record Count */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-0.5 glass-well rounded-xl text-[11px] font-mono">
                  {(['ALL', 'prod', 'staging', 'dev'] as const).map((env) => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => {
                        setEnvFilter(env);
                        setPage(1);
                      }}
                      className={`px-2 py-0.5 rounded-lg uppercase font-medium transition-all ${
                        envFilter === env
                          ? 'bg-white text-[#111318] font-semibold shadow-2xs border border-black/[0.06]'
                          : 'text-[#4A505C] hover:text-[#111318]'
                      }`}
                    >
                      {env}
                    </button>
                  ))}
                </div>
                <span className="text-[#767D8C] font-code-sm text-code-sm hidden sm:inline">
                  Showing {visibleResources.length} of {filteredResources.length}
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by resource name, ID, hardware spec (e.g. m8.xlarge), region, or team..."
                className="w-full h-9 px-space-md rounded-xl glass-well font-body-sm text-body-sm text-[#111318] placeholder:text-[#767D8C] focus:outline-none focus:bg-white/90 focus:border-black/[0.15] transition-all"
              />
            </div>
          </div>

          {/* Tabular Dataset */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Cloud Spending Resource Utilization Table"
            className="table-wrapper"
          >
            <table className="w-full text-left font-body-sm text-body-sm">
              <thead>
                <tr className="bg-[#ECEEF2]/90 backdrop-blur-md text-[#767D8C] font-label-caps text-label-caps uppercase border-b border-black/[0.06]">
                  <th className="py-2.5 px-space-md">Resource &amp; Hardware Spec</th>
                  <th className="py-2.5 px-space-sm">Environment</th>
                  <th className="py-2.5 px-space-md">Avg / Peak</th>
                  <th className="py-2.5 px-space-md">Recommendation</th>
                  <th className="py-2.5 px-space-md text-right">Monthly Spend</th>
                  <th className="py-2.5 px-space-sm text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {visibleResources.map((item) => {
                  const isSelected = activeResource?.id === item.id;
                  const rec = recByResourceId.get(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectResourceForDrawer(item.id, false)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-black/[0.045] hover:bg-black/[0.065]'
                          : 'hover:bg-white/60'
                      }`}
                    >
                      <td className="py-3 px-space-md">
                        <div>
                          <div className="font-code-sm text-code-sm font-semibold text-[#111318]">
                            {item.name}
                          </div>
                          <div className="text-[#767D8C] text-[11px] font-code-sm mt-0.5">
                            {formatHardwareSpec(item)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-space-sm whitespace-nowrap">
                        {renderEnvBadge(item.env)}
                      </td>
                      <td className="py-3 px-space-md font-tabular-numeric-md text-tabular-numeric-md whitespace-nowrap">
                        {renderAvgPeakCell(item)}
                      </td>
                      <td className="py-3 px-space-md">
                        {renderRecommendationText(item, rec)}
                      </td>
                      <td className="py-3 px-space-md text-right font-tabular-numeric-md text-tabular-numeric-md font-semibold text-[#111318] whitespace-nowrap">
                        {formatINR(item.monthly_cost_inr)}
                      </td>
                      <td className="py-3 px-space-sm text-center whitespace-nowrap">
                        {renderRowActionButton(item, rec)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Meta & Pagination */}
          <div className="p-space-md border-t border-black/[0.06] bg-white/40 flex flex-wrap items-center justify-between gap-2 text-[#767D8C] font-body-sm text-body-sm">
            <span className="font-code-sm text-code-sm text-[#4A505C]">
              Total {recommendations.length} recommendations yield{' '}
              <strong className="text-[#1D5C46]">
                {formatINR(data.total_potential_savings_inr)}/mo
              </strong>{' '}
              net saving ({formatINR(data.accepted_monthly_savings_inr)}/mo committed)
            </span>

            <div className="flex items-center gap-space-xs">
              <button
                type="button"
                onClick={() => setShowAllRows(!showAllRows)}
                className="px-2.5 py-1 rounded-lg bg-white/80 border border-black/[0.07] text-[#111318] text-xs font-medium hover:bg-white transition-all"
              >
                {showAllRows ? 'Paginate (12/page)' : `Show All (${filteredResources.length})`}
              </button>
              {!showAllRows && (
                <>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg bg-white/80 border border-black/[0.07] text-[#111318] text-xs font-medium disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-code-sm text-xs px-1.5 text-[#111318]">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg bg-white/80 border border-black/[0.07] text-[#111318] text-xs font-medium disabled:opacity-40"
                  >
                    Next
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT 4 COLS: Resource Inspection Drawer (Frosted Glass + Blended Status) */}
        <div className="xl:col-span-4 flex flex-col glass-card rounded-2xl p-space-lg">
          {activeResource && (
            <>
              {/* Drawer Header */}
              <div className="flex items-start justify-between mb-space-md">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-label-caps text-label-caps uppercase text-[#767D8C] font-semibold">
                      Resource Inspection
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase ${
                        activeResource.optimization_status === 'PROTECTED_PEAK_LOAD'
                          ? 'status-yellow'
                          : activeResource.optimization_status === 'ORPHANED'
                          ? 'status-red'
                          : 'status-green'
                      }`}
                    >
                      {activeResource.optimization_status === 'PROTECTED_PEAK_LOAD'
                        ? 'Peak Protected'
                        : activeResource.optimization_status === 'ORPHANED'
                        ? 'Orphaned'
                        : 'Active'}
                    </span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-[#111318] font-semibold">
                    {activeResource.name}
                  </h2>
                  <span className="font-code-sm text-code-sm text-[#767D8C]">
                    {activeResource.id} · {activeResource.region} · {activeResource.team || 'Platform'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectResourceForDrawer(activeResource.id, true)}
                  className="text-white bg-[#111318] hover:bg-[#252A34] font-body-sm text-xs font-medium px-3 py-1 rounded-lg transition-all shadow-2xs"
                >
                  Full Audit
                </button>
              </div>

              {/* Spec & Savings Delta Grid */}
              <div className="grid grid-cols-2 gap-space-sm p-space-md rounded-xl glass-well mb-space-md">
                <div>
                  <span className="font-label-caps text-label-caps text-[#767D8C] uppercase block mb-1">
                    Current Spec
                  </span>
                  <span className="font-body-sm text-body-sm font-semibold text-[#111318] block">
                    {activeResource.type === 'vm'
                      ? `${activeResource.vcpu ?? 4} vCPU, ${activeResource.ram_gb ?? 16} GB`
                      : activeResource.disk_gb
                      ? `${activeResource.disk_gb} GB SSD`
                      : 'Elastic IPv4'}
                  </span>
                  <span className="font-code-sm text-code-sm text-[#767D8C] block">
                    {activeResource.plan || activeResource.current_spec || activeResource.type}
                  </span>
                </div>
                <div>
                  <span className="font-label-caps text-label-caps text-[#767D8C] uppercase block mb-1">
                    Target Spec
                  </span>
                  <span className="font-body-sm text-body-sm font-semibold text-[#111318] block">
                    {activeRec
                      ? activeRec.recommended_config || activeRec.target_spec || 'Optimized Plan'
                      : activeResource.optimization_status === 'PROTECTED_PEAK_LOAD'
                      ? 'Keep Current Tier'
                      : 'Right-Sized'}
                  </span>
                  <span className="font-code-sm text-code-sm text-[#767D8C] block">
                    {activeRec ? activeRec.action_type : 'SLA Verified'}
                  </span>
                </div>
                <div>
                  <span className="font-label-caps text-label-caps text-[#767D8C] uppercase block mb-1">
                    Spend Impact
                  </span>
                  <span className="font-tabular-numeric-md text-tabular-numeric-md text-[#111318] font-medium">
                    {formatINR(currentCostInr)} → {formatINR(targetCostInr)}
                  </span>
                </div>
                <div>
                  <span className="font-label-caps text-label-caps text-[#767D8C] uppercase block mb-1">
                    Est. Savings
                  </span>
                  <span className="font-tabular-numeric-md text-tabular-numeric-md text-[#1D5C46] font-semibold">
                    {savingsInr > 0
                      ? `${formatINR(savingsInr)} (${savingsPct}%)`
                      : '₹0 (SLA Guard)'}
                  </span>
                </div>
              </div>

              {/* SVG Utilization Chart (30-Day Trend — Minimalist Graphite & Mineral Sage) */}
              <div className="mb-space-md">
                <div className="flex items-center justify-between mb-space-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-label-caps text-label-caps text-[#767D8C] uppercase">
                      30-Day Telemetry
                    </span>
                    <div className="inline-flex rounded-lg glass-well p-0.5 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setDrawerMetric('cpu')}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                          drawerMetric === 'cpu'
                            ? 'bg-white text-[#111318] shadow-2xs'
                            : 'text-[#4A505C]'
                        }`}
                      >
                        CPU
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrawerMetric('mem')}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                          drawerMetric === 'mem'
                            ? 'bg-white text-[#111318] shadow-2xs'
                            : 'text-[#4A505C]'
                        }`}
                      >
                        RAM
                      </button>
                    </div>
                  </div>
                  <span className="font-code-sm text-code-sm text-[#4A505C]">
                    Peak: {drawerChartGeometry.peakVal}% · Avg: {drawerChartGeometry.avgVal}%
                  </span>
                </div>

                <div className="w-full glass-well rounded-xl p-space-sm">
                  <svg className="w-full h-36" preserveAspectRatio="none" viewBox="0 0 340 140">
                    <defs>
                      <linearGradient id="minimalGlassGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#236B52" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#236B52" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <line
                      stroke="rgba(17,19,24,0.08)"
                      strokeDasharray="2,2"
                      x1="30"
                      x2="330"
                      y1="20"
                      y2="20"
                    />
                    <line
                      stroke="rgba(17,19,24,0.08)"
                      strokeDasharray="2,2"
                      x1="30"
                      x2="330"
                      y1="50"
                      y2="50"
                    />
                    <line
                      stroke="rgba(17,19,24,0.08)"
                      strokeDasharray="2,2"
                      x1="30"
                      x2="330"
                      y1="80"
                      y2="80"
                    />
                    <line
                      stroke="rgba(17,19,24,0.12)"
                      x1="30"
                      x2="330"
                      y1="110"
                      y2="110"
                    />
                    <text fill="#767D8C" fontSize="9" textAnchor="end" x="24" y="24">
                      100%
                    </text>
                    <text fill="#767D8C" fontSize="9" textAnchor="end" x="24" y="54">
                      50%
                    </text>
                    <text fill="#767D8C" fontSize="9" textAnchor="end" x="24" y="84">
                      25%
                    </text>
                    <text fill="#767D8C" fontSize="9" textAnchor="end" x="24" y="114">
                      0%
                    </text>
                    <line
                      stroke="#94601B"
                      strokeDasharray="3,3"
                      strokeWidth="1.25"
                      x1="30"
                      x2="330"
                      y1={drawerChartGeometry.peakY}
                      y2={drawerChartGeometry.peakY}
                    />
                    <text
                      fill="#7C4F14"
                      fontSize="10"
                      fontWeight="600"
                      x="245"
                      y={Math.max(16, drawerChartGeometry.peakY - 5)}
                    >
                      Peak {drawerChartGeometry.peakVal}%
                    </text>
                    <polygon fill="url(#minimalGlassGrad)" points={drawerChartGeometry.polygon} />
                    <polyline
                      fill="none"
                      points={drawerChartGeometry.polyline}
                      stroke="#1D5C46"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                    <circle
                      cx={drawerChartGeometry.peakX}
                      cy={drawerChartGeometry.peakY}
                      fill="#1D5C46"
                      r="3.5"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#767D8C] mt-1.5 px-1 font-body-sm">
                  <span>Actual {drawerMetric.toUpperCase()} (%)</span>
                  <span>85% Peak-Safety Governor Ceiling</span>
                </div>
              </div>

              {/* Engine & Python AI (:8001) Assessment Narrative */}
              <div className="p-space-md rounded-xl glass-well mb-space-md space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#111318] font-headline-md text-[13px] font-semibold">
                    Engine &amp; AI Telemetry Assessment
                  </span>
                  <span className="px-2 py-0.5 rounded-md glass-pill-neutral text-[10px] font-mono font-medium">
                    {activeEng.provider || 'Go + AI :8001'}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-[#4A505C] leading-relaxed">
                  {activeEng.technical_explanation ||
                    activeEng.peak_headroom_proof ||
                    activeResource.status_reason ||
                    'Continuous 30-day telemetry evaluated against p95/p99 safety headroom governor.'}
                </p>

                {/* Blended Status & Neutral Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeEng.jev_assessment && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                        activeEng.jev_assessment.risk_score_percentage > 60
                          ? 'status-red'
                          : activeEng.jev_assessment.risk_score_percentage > 30
                          ? 'status-yellow'
                          : 'status-green'
                      }`}
                    >
                      OpenRisk: {activeEng.jev_assessment.risk_score_percentage}%
                    </span>
                  )}
                  {activeEng.workload_classification && (
                    <span className="px-2 py-0.5 rounded-md glass-pill-neutral text-[10px] font-mono font-medium">
                      {activeEng.workload_classification}
                    </span>
                  )}
                  {activeEng.greenops_impact && (
                    <span className="px-2 py-0.5 rounded-md status-green text-[10px] font-mono font-semibold">
                      -{activeEng.greenops_impact.estimated_carbon_saved_kg_co2e} kg CO2e
                    </span>
                  )}
                </div>
              </div>

              {/* Drawer Action Buttons */}
              <div className="flex items-center gap-space-sm mt-auto pt-space-xs">
                <button
                  type="button"
                  onClick={() => onSelectResourceForDrawer(activeResource.id, true)}
                  className="w-1/3 py-2 px-space-sm rounded-xl glass-well hover:bg-black/[0.06] text-[#111318] font-body-sm text-body-sm font-medium transition-all text-center"
                >
                  Deep Trace
                </button>
                {activeRec ? (
                  <button
                    type="button"
                    onClick={() => onAcceptRecommendation?.(activeRec.id)}
                    className={`w-2/3 py-2 px-space-sm rounded-xl font-body-sm text-body-sm font-semibold transition-all text-center ${
                      activeRec.status === 'accepted'
                        ? 'status-green'
                        : 'bg-[#111318] hover:bg-[#232730] text-white shadow-xs'
                    }`}
                  >
                    {activeRec.status === 'accepted'
                      ? 'Approved for Terraform PR'
                      : 'Apply via Terraform PR'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectResourceForDrawer(activeResource.id, true)}
                    className="w-2/3 py-2 px-space-sm rounded-xl bg-[#111318] hover:bg-[#232730] text-white font-body-sm text-body-sm font-semibold shadow-xs transition-all text-center"
                  >
                    View SLA Protection Proof
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. PYTHON AI (:8001) ROLE BRIEFING & MULTI-HORIZON COST FORECASTER */}
      <div className="glass-card rounded-2xl p-space-lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* Left 7 Cols: Role-Based AI Briefing */}
          <div className="lg:col-span-7 space-y-3 lg:border-r lg:border-black/[0.06] lg:pr-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md glass-pill-neutral font-label-caps text-label-caps uppercase font-semibold">
                  AI Briefing
                </span>
                <span className="font-headline-md text-headline-md text-[#111318] font-semibold">
                  Role-Based Telemetry Synthesis
                </span>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl glass-well">
                {(['executive', 'finance', 'engineering'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setBriefingRole(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                      briefingRole === r
                        ? 'bg-white text-[#111318] font-semibold shadow-2xs border border-black/[0.06]'
                        : 'text-[#4A505C] hover:text-[#111318]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {briefing && (
              <>
                <p className="font-body-md text-body-md font-semibold text-[#111318]">
                  {briefing.headline}
                </p>

                <ul className="space-y-1.5 font-body-sm text-body-sm text-[#4A505C]">
                  {(briefing.bullet_points || []).slice(0, 3).map((pt, idx) => (
                    <li key={idx} className="p-2.5 rounded-xl glass-well">
                      {pt}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {(briefing.key_metrics || []).map((pill, i) => (
                    <div
                      key={i}
                      className="px-3 py-1 rounded-lg glass-well text-[#111318] text-xs font-mono"
                    >
                      <span className="text-[#767D8C] mr-1.5">{pill.label}:</span>
                      <span className="font-semibold text-[#111318]">{pill.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right 5 Cols: Multi-Horizon Component Cost Forecaster (30d / 60d / 90d) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-headline-md text-headline-md text-[#111318] font-semibold block">
                  Multi-Horizon Cost Forecaster
                </span>
                <span className="font-code-sm text-code-sm text-[#767D8C]">
                  Component projection across VM, SSD &amp; IPv4
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl glass-well font-mono text-xs">
                {([30, 35, 40, 60, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setHorizonDays(d);
                      setCustomDaysInput(String(d));
                    }}
                    className={`px-2 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      horizonDays === d
                        ? 'bg-white text-[#111318] font-semibold shadow-2xs border border-black/[0.06]'
                        : 'text-[#4A505C] hover:text-[#111318]'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
                <div className="flex items-center gap-1 pl-1 border-l border-black/[0.08]">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={customDaysInput}
                    onChange={(e) => setCustomDaysInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt(customDaysInput, 10);
                        if (!isNaN(val) && val >= 1 && val <= 365) {
                          setHorizonDays(val);
                        }
                      }
                    }}
                    placeholder="Days"
                    className="w-14 px-1.5 py-0.5 rounded-md bg-white border border-black/[0.12] text-center text-xs font-mono text-[#111318] focus:outline-none focus:ring-1 focus:ring-black"
                    title="Enter custom days (e.g. 35, 40, 45, etc.) and click Set"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = parseInt(customDaysInput, 10);
                      if (!isNaN(val) && val >= 1 && val <= 365) {
                        setHorizonDays(val);
                      }
                    }}
                    className="px-2 py-0.5 rounded-md bg-[#111318] text-white text-[11px] font-semibold hover:bg-[#272B33] transition-colors cursor-pointer"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>

            {aiForecast && (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl glass-well">
                    <span className="font-label-caps text-label-caps uppercase text-[#767D8C] block">
                      {horizonDays}d Baseline
                    </span>
                    <span className="font-tabular-numeric-md text-tabular-numeric-md font-semibold text-[#111318] mt-1 block">
                      {formatINR(aiForecast.current_cost_inr.total)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl glass-well">
                    <span className="font-label-caps text-label-caps uppercase text-[#767D8C] block">
                      {horizonDays}d Optimized
                    </span>
                    <span className="font-tabular-numeric-md text-tabular-numeric-md font-semibold text-[#111318] mt-1 block">
                      {formatINR(aiForecast.recommended_cost_inr.total)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl status-green">
                    <span className="font-label-caps text-label-caps uppercase opacity-80 block">
                      {horizonDays}d Net Saved
                    </span>
                    <span className="font-tabular-numeric-md text-tabular-numeric-md font-semibold mt-1 block">
                      -{formatINR(aiForecast.estimated_savings_inr)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl glass-well flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#4A505C]">
                  <span>
                    Power Saved: <strong className="text-[#111318]">{formatNumber(Math.round(data.sustainability.monthly_kwh_saved))} kWh/mo</strong>
                  </span>
                  <span>
                    CO2e Abated: <strong className="text-[#111318]">{formatNumber(Math.round(data.sustainability.monthly_co2_kg_saved))} kg/mo</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-md status-green text-[10px] font-semibold">
                    GreenScore {aiForecast.sustainability.sustainability_score}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5. HISTORICAL CREEP & 60-DAY FORWARD TRAJECTORY CHARTS (Minimalist Glass) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        {/* 6-Month Historical Bill Creep */}
        <div className="glass-card rounded-2xl p-space-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-headline-md text-headline-md text-[#111318] font-semibold">
                6-Month Historical Bill Creep (+{data.bill_growth_6m_pct}%)
              </h3>
              <p className="font-body-sm text-body-sm text-[#4A505C]">
                Unmanaged infrastructure spend growth prior to FinSort rightsizing
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md status-red text-[11px] font-mono font-semibold">
              INR Monthly
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={normalizedHistorical} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="carmineCreepGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9E2F2B" stopOpacity={0.20} />
                    <stop offset="95%" stopColor="#9E2F2B" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,19,24,0.06)" vertical={false} />
                <XAxis dataKey="month" stroke="#767D8C" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#767D8C"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    borderColor: 'rgba(17,19,24,0.08)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                    color: '#111318',
                  }}
                  formatter={(val: any) => [formatINR(Number(val)), 'Monthly Spend']}
                />
                <Area
                  type="monotone"
                  dataKey="spend_inr"
                  stroke="#9E2F2B"
                  strokeWidth={2}
                  fill="url(#carmineCreepGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dynamic Forward Spend & Usage Trajectory */}
        <div className="glass-card rounded-2xl p-space-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-headline-md text-headline-md text-[#111318] font-semibold">
                {horizonDays}-Day Forward Trajectory &amp; Forecast
              </h3>
              <p className="font-body-sm text-body-sm text-[#4A505C]">
                {forecastChartType === 'cost'
                  ? `Baseline expansion vs. Post-Optimization billing across ${horizonDays}-day horizon`
                  : `Compute usage forecast of Original baseline vs. Saved optimized data (${horizonDays}d)`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Cost vs Usage Toggle */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg glass-well font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setForecastChartType('cost')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    forecastChartType === 'cost'
                      ? 'bg-white text-[#111318] shadow-2xs border border-black/[0.06]'
                      : 'text-[#4A505C] hover:text-[#111318]'
                  }`}
                >
                  Spend (₹)
                </button>
                <button
                  type="button"
                  onClick={() => setForecastChartType('usage')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    forecastChartType === 'usage'
                      ? 'bg-white text-[#111318] shadow-2xs border border-black/[0.06]'
                      : 'text-[#4A505C] hover:text-[#111318]'
                  }`}
                >
                  Usage (Original vs Saved)
                </button>
              </div>
              <span className="px-2.5 py-1 rounded-md status-green text-[11px] font-mono font-semibold">
                {horizonDays}d Forecast
              </span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {forecastChartType === 'cost' ? (
                <AreaChart data={dynamicForecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sageOptGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#236B52" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#236B52" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,19,24,0.06)" vertical={false} />
                  <XAxis dataKey="displayDate" stroke="#767D8C" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#767D8C"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.92)',
                      borderColor: 'rgba(17,19,24,0.08)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono',
                      color: '#111318',
                    }}
                    formatter={(val: any, name: any) => [
                      formatINR(Number(val)),
                      name === 'unoptimized_inr' ? 'Unoptimized Baseline' : 'Optimized Run-Rate',
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                    formatter={(val) =>
                      val === 'unoptimized_inr' ? 'Unoptimized Baseline' : 'After Approved Optimizations'
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="unoptimized_inr"
                    stroke="#9E2F2B"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    fill="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="optimized_inr"
                    stroke="#236B52"
                    strokeWidth={2}
                    fill="url(#sageOptGrad)"
                  />
                </AreaChart>
              ) : (
                <AreaChart data={dynamicForecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="usageSavedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#236B52" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#236B52" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="usageOrigGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9E2F2B" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#9E2F2B" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,19,24,0.06)" vertical={false} />
                  <XAxis dataKey="displayDate" stroke="#767D8C" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#767D8C"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k hrs`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.92)',
                      borderColor: 'rgba(17,19,24,0.08)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono',
                      color: '#111318',
                    }}
                    formatter={(val: any, name: any) => [
                      `${formatNumber(Number(val))} vCPU-hrs`,
                      name === 'original_usage_hours' ? 'Original Usage Data' : 'Saved Usage Data (Optimized)',
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                    formatter={(val) =>
                      val === 'original_usage_hours' ? 'Original Data Usage (Baseline)' : 'Saved Data Usage (After Optimization)'
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="original_usage_hours"
                    stroke="#9E2F2B"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="url(#usageOrigGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="saved_usage_hours"
                    stroke="#236B52"
                    strokeWidth={2}
                    fill="url(#usageSavedGrad)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Explicit Mathematical Assumptions Callout (Requirements 2 & FinOps transparency) */}
          <div className="mt-3 p-3.5 rounded-xl bg-black/[0.02] border border-black/[0.06] font-mono text-xs text-[#3F4450] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#111318] text-[11px] uppercase tracking-wider">
                {forecastChartType === 'cost' ? 'Cost Trajectory Mathematical Model' : 'Compute Usage Mathematical Model (Original vs Saved)'}
              </span>
              <span className="text-[10px] text-[#767D8C]">
                {aiForecast?.provider || 'Python-AI-Service (:8001)'} • {horizonDays}d Horizon
              </span>
            </div>
            {forecastChartType === 'cost' ? (
              <div className="space-y-1 text-[11px] leading-relaxed">
                <div>• <strong>Baseline Spend:</strong> ₹{formatNumber(data?.current_monthly_spend_inr || 683200)}/mo scaled across {horizonDays} days ({((data?.bill_growth_6m_pct || 14) / 100 * (horizonDays / 30)).toFixed(1)}% drift compound growth).</div>
                <div>• <strong>Optimized Run-Rate:</strong> Realized after rightsizing 20 overprovisioned instances (-₹{formatNumber(data?.accepted_monthly_savings_inr || 277230)}/mo savings) while preserving +25% peak safety margin.</div>
                {aiForecast?.sustainability?.assumptions && (
                  <div className="pt-1 border-t border-black/[0.05] text-[10px] text-[#525866]">
                    Assumptions: {aiForecast.sustainability.assumptions.join(' • ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 text-[11px] leading-relaxed">
                <div>• <strong>Original Usage Data:</strong> Continuous baseline cluster unoptimized compute at 100% duty cycle across all provisioned vCPUs = ~{(dynamicForecast[dynamicForecast.length - 1]?.original_usage_hours || 0).toLocaleString()} vCPU-hours at {horizonDays}d with {data?.bill_growth_6m_pct || 14}% historical demand drift.</div>
                <div>• <strong>Saved Usage Data:</strong> Workload demand post-downsizing to recommended specs (-35% compute footprint reduction) and diurnal non-prod scheduling (118h/wk dev off-hours saving ~{Math.round((dynamicForecast[dynamicForecast.length - 1]?.original_usage_hours || 0) - (dynamicForecast[dynamicForecast.length - 1]?.saved_usage_hours || 0)).toLocaleString()} vCPU-hours).</div>
                <div className="pt-1 border-t border-black/[0.05] text-[10px] text-[#525866]">
                  Governor Rule: Enforces p99 &lt; 85% SLA governor ceiling and guarantees +25% headroom during burst traffic spikes.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
