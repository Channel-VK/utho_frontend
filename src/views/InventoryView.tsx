import React, { useState } from 'react';
import {
  Server,
  HardDrive,
  Globe,
  ShieldCheck,
  AlertTriangle,
  Search,
  Zap,
  Clock,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import type { Resource } from '../types/api';
import { formatINR } from '../utils/format';

interface InventoryViewProps {
  resources: Resource[];
  selectedStatusFilter?: string;
  onSelectResource: (id: string) => void;
}

type TriageFilter =
  | 'ALL'
  | 'NEEDS_ACTION'
  | 'PEAK_PROTECTED'
  | 'ORPHANED'
  | 'OFF_HOURS';

export const InventoryView: React.FC<InventoryViewProps> = ({
  resources,
  selectedStatusFilter = 'ALL',
  onSelectResource,
}) => {
  // Map incoming initial status filter to triage filter if applicable
  const initialTriage =
    selectedStatusFilter === 'PROTECTED_PEAK_LOAD'
      ? 'PEAK_PROTECTED'
      : selectedStatusFilter === 'ORPHANED'
      ? 'ORPHANED'
      : selectedStatusFilter === 'IDLE_SCHEDULE_CANDIDATE'
      ? 'OFF_HOURS'
      : 'ALL';

  const [triageFilter, setTriageFilter] = useState<TriageFilter>(initialTriage);
  const [envFilter, setEnvFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Triage count tallies
  const countAll = resources.length;
  const countNeedsAction = resources.filter((r) =>
    ['OVERPROVISIONED', 'IDLE_SCHEDULE_CANDIDATE', 'ZOMBIE', 'ORPHANED'].includes(
      r.optimization_status
    )
  ).length;
  const countPeakProtected = resources.filter(
    (r) => r.optimization_status === 'PROTECTED_PEAK_LOAD'
  ).length;
  const countOrphaned = resources.filter(
    (r) => r.optimization_status === 'ORPHANED'
  ).length;
  const countOffHours = resources.filter(
    (r) => r.optimization_status === 'IDLE_SCHEDULE_CANDIDATE'
  ).length;

  // Filter application
  const filtered = resources.filter((r) => {
    // 1. Triage Filter
    if (triageFilter === 'NEEDS_ACTION') {
      if (
        !['OVERPROVISIONED', 'IDLE_SCHEDULE_CANDIDATE', 'ZOMBIE', 'ORPHANED'].includes(
          r.optimization_status
        )
      )
        return false;
    } else if (triageFilter === 'PEAK_PROTECTED') {
      if (r.optimization_status !== 'PROTECTED_PEAK_LOAD') return false;
    } else if (triageFilter === 'ORPHANED') {
      if (r.optimization_status !== 'ORPHANED') return false;
    } else if (triageFilter === 'OFF_HOURS') {
      if (r.optimization_status !== 'IDLE_SCHEDULE_CANDIDATE') return false;
    }

    // 2. Env Filter
    if (envFilter !== 'ALL' && r.env.toLowerCase() !== envFilter.toLowerCase()) return false;

    // 3. Region Filter
    if (regionFilter !== 'ALL') {
      if (regionFilter === 'Noida' && !r.region.includes('noida')) return false;
      if (regionFilter === 'Bangalore' && !r.region.includes('bangalore')) return false;
      if (regionFilter === 'Mumbai' && !r.region.includes('mumbai')) return false;
    }

    // 4. Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const match =
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.plan && r.plan.toLowerCase().includes(q)) ||
        (r.team && r.team.toLowerCase().includes(q)) ||
        (r.ip_address && r.ip_address.includes(q));
      if (!match) return false;
    }

    return true;
  });

  // Render Current Spec properly from Go backend fields
  const renderCurrentSpec = (r: Resource) => {
    const isVm = r.type === 'vm';
    const isVolume =
      r.type === 'volume' || r.type === 'block_volume' || r.type === 'block_ssd';
    const isIp = r.type === 'public_ip' || r.type === 'public_ipv4';

    if (isVm) {
      const planName = r.plan || r.current_spec?.split(' ')[0] || 'm8.xlarge';
      const vcpu = r.vcpu ?? (r.current_spec ? parseInt(r.current_spec) : 4);
      const ram = r.ram_gb ?? 16;
      return (
        <div>
          <div className="font-semibold text-zinc-100 font-mono text-xs">{planName}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            {vcpu} vCPU · {ram} GB RAM
          </div>
        </div>
      );
    }

    if (isVolume) {
      const size = r.disk_gb || 500;
      return (
        <div>
          <div className="font-semibold text-zinc-100 text-xs">Block SSD</div>
          <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">{size} GB</div>
        </div>
      );
    }

    if (isIp) {
      return (
        <div>
          <div className="font-semibold text-zinc-100 text-xs">Public IPv4</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Unattached</div>
        </div>
      );
    }

    return (
      <div>
        <div className="font-semibold text-zinc-100 text-xs">{r.plan || r.type}</div>
        <div className="text-[11px] text-zinc-400 mt-0.5">{r.current_spec || 'Standard'}</div>
      </div>
    );
  };

  // Render Human-Friendly Badges & Inline Subtitle
  const renderHumanStatus = (r: Resource) => {
    const status = r.optimization_status;
    const cpuAvg = Math.round(r.metrics_summary?.cpu_avg || 0);
    const cpuP99 = Math.round(r.metrics_summary?.cpu_p99 || 0);

    switch (status) {
      case 'PROTECTED_PEAK_LOAD':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center space-x-1.5 rounded-full border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
              <ShieldCheck className="h-3 w-3 text-cyan-400 shrink-0" />
              <span>Peak Protected (Keep Size)</span>
            </span>
            <div className="text-[10px] text-cyan-400/80 font-mono">
              {cpuAvg}% avg, but {cpuP99}% daily peak
            </div>
          </div>
        );

      case 'OVERPROVISIONED':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center space-x-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              <Zap className="h-3 w-3 text-emerald-400 shrink-0" />
              <span>Downsize Ready</span>
            </span>
            <div className="text-[10px] text-zinc-400 font-sans">
              Peak &lt; 25% — Downsize to save
            </div>
          </div>
        );

      case 'IDLE_SCHEDULE_CANDIDATE':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center space-x-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
              <Clock className="h-3 w-3 text-indigo-400 shrink-0" />
              <span>Off-Hours Schedule</span>
            </span>
            <div className="text-[10px] text-zinc-400 font-sans">
              Idle 118 hrs/wk (Nights/Wknd)
            </div>
          </div>
        );

      case 'ORPHANED':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center space-x-1.5 rounded-full border border-rose-500/30 bg-rose-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
              <Trash2 className="h-3 w-3 text-rose-400 shrink-0" />
              <span>Orphaned Waste</span>
            </span>
            <div className="text-[10px] text-zinc-400 font-sans">
              Unattached — 0 IOPS
            </div>
          </div>
        );

      case 'ZOMBIE':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center space-x-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
              <span>Zombie VM</span>
            </span>
            <div className="text-[10px] text-zinc-400 font-sans">
              Idle 90+ days (&lt;3% CPU)
            </div>
          </div>
        );

      case 'OPTIMAL':
      default:
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center space-x-1 rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
              <CheckCircle className="h-3 w-3 text-zinc-400 shrink-0" />
              <span>Right-Sized</span>
            </span>
            <div className="text-[10px] text-zinc-500 font-sans">Operating within SLA</div>
          </div>
        );
    }
  };

  // Render 2-point CPU / RAM Story without noisy wall of decimals
  const renderMetricStory = (
    avgVal: number,
    p50: number,
    p95: number,
    p99Val: number,
    type: 'cpu' | 'mem'
  ) => {
    const avg = Math.round(avgVal);
    const peak = Math.round(p99Val);
    const isHighPeak = peak >= 80;
    const isLowPeak = peak < 40;

    const peakColorClass = isHighPeak
      ? 'text-amber-400'
      : isLowPeak
      ? 'text-emerald-400'
      : 'text-cyan-400';

    const barFillColor =
      type === 'cpu'
        ? isHighPeak
          ? 'bg-amber-400'
          : 'bg-emerald-500'
        : 'bg-purple-500';

    const tooltipText = `${type.toUpperCase()} Telemetry: avg ${avgVal.toFixed(1)}% · p50 ${p50.toFixed(1)}% · p95 ${p95.toFixed(1)}% · p99 ${p99Val.toFixed(1)}%`;

    return (
      <div className="w-36 space-y-1.5" title={tooltipText}>
        {/* Line 1: Avg (muted) on left, Peak (bold) on right */}
        <div className="flex justify-between items-baseline text-xs font-mono">
          <span className="text-zinc-400 text-[11px]">Avg {avg}%</span>
          <span className={`font-bold ${peakColorClass}`}>Peak {peak}%</span>
        </div>

        {/* Line 2: Dual layer horizontal bar showing Average fill vs Peak marker */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          {/* Average fill */}
          <div
            className={`absolute top-0 bottom-0 left-0 ${barFillColor} opacity-70`}
            style={{ width: `${Math.min(100, Math.max(2, avg))}%` }}
          />
          {/* Peak marker tick */}
          <div
            className={`absolute top-0 bottom-0 ${
              isHighPeak ? 'bg-amber-400' : 'bg-cyan-400'
            }`}
            style={{
              left: `${Math.min(98, Math.max(avg, peak - 2))}%`,
              width: '3px',
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Resource Inventory & Peak-Safety Inspector
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            High-density telemetry inspection. Automated Peak-Safety Governor ensures bursty workloads are protected.
          </p>
        </div>
        <div className="flex items-center space-x-2 font-mono text-xs text-zinc-400">
          <span>
            Showing <strong className="text-zinc-200">{filtered.length}</strong> of {resources.length} resources
          </span>
        </div>
      </div>

      {/* 1-Click Triage Pills & Compact Filters Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-2.5">
        {/* Left: Quick Triage Segmented Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-0.5">
          <button
            onClick={() => setTriageFilter('ALL')}
            className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
              triageFilter === 'ALL'
                ? 'border border-zinc-700 bg-zinc-800 text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <span>All Resources</span>
            <span className="rounded-full bg-zinc-700/60 px-1.5 py-0.2 text-[10px] font-mono text-zinc-300">
              {countAll}
            </span>
          </button>

          <button
            onClick={() => setTriageFilter('NEEDS_ACTION')}
            className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
              triageFilter === 'NEEDS_ACTION'
                ? 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 shadow-xs'
                : 'text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50'
            }`}
          >
            <Zap className="h-3 w-3 text-emerald-400" />
            <span>Needs Action</span>
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-mono text-emerald-400">
              {countNeedsAction}
            </span>
          </button>

          <button
            onClick={() => setTriageFilter('PEAK_PROTECTED')}
            className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
              triageFilter === 'PEAK_PROTECTED'
                ? 'border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 shadow-xs'
                : 'text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800/50'
            }`}
          >
            <ShieldCheck className="h-3 w-3 text-cyan-400" />
            <span>Peak Protected</span>
            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-mono text-cyan-300">
              {countPeakProtected}
            </span>
          </button>

          <button
            onClick={() => setTriageFilter('ORPHANED')}
            className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
              triageFilter === 'ORPHANED'
                ? 'border border-rose-500/40 bg-rose-950/40 text-rose-300 shadow-xs'
                : 'text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/50'
            }`}
          >
            <Trash2 className="h-3 w-3 text-rose-400" />
            <span>Orphaned Disks & IPs</span>
            <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-mono text-rose-300">
              {countOrphaned}
            </span>
          </button>

          <button
            onClick={() => setTriageFilter('OFF_HOURS')}
            className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
              triageFilter === 'OFF_HOURS'
                ? 'border border-indigo-500/40 bg-indigo-950/40 text-indigo-300 shadow-xs'
                : 'text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800/50'
            }`}
          >
            <Clock className="h-3 w-3 text-indigo-400" />
            <span>Off-Hours Candidates</span>
            <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[10px] font-mono text-indigo-300">
              {countOffHours}
            </span>
          </button>
        </div>

        {/* Right: Compact Search + Env Toggle + Region Toggle */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or ID..."
              className="w-44 sm:w-48 rounded-md border border-zinc-700 bg-zinc-950 pl-8 pr-2.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Compact Env Pill Toggle */}
          <div className="flex items-center rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-[11px] font-mono">
            {['ALL', 'prod', 'staging', 'dev'].map((e) => (
              <button
                key={e}
                onClick={() => setEnvFilter(e)}
                className={`rounded px-2 py-0.5 uppercase transition-colors ${
                  envFilter.toLowerCase() === e.toLowerCase()
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {e === 'ALL' ? 'All' : e}
              </button>
            ))}
          </div>

          {/* Compact Region Pill Toggle */}
          <div className="hidden sm:flex items-center rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-[11px] font-mono">
            {['ALL', 'Noida', 'Bangalore', 'Mumbai'].map((r) => (
              <button
                key={r}
                onClick={() => setRegionFilter(r)}
                className={`rounded px-2 py-0.5 transition-colors ${
                  regionFilter === r
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {r === 'ALL' ? 'All' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Spacious High-Density Inventory Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-4 py-3.5">Resource Name & ID</th>
                <th className="px-4 py-3.5">Env / Region</th>
                <th className="px-4 py-3.5">Current Spec</th>
                <th className="px-4 py-3.5 text-right">Tariff (₹/mo)</th>
                <th className="px-4 py-3.5">CPU (Avg / Peak)</th>
                <th className="px-4 py-3.5">RAM (Avg / Peak)</th>
                <th className="px-4 py-3.5">FinOps Recommendation Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {filtered.map((item) => {
                const isProtected = item.optimization_status === 'PROTECTED_PEAK_LOAD';
                const isZombie = item.optimization_status === 'ZOMBIE';
                const TypeIcon =
                  item.type === 'vm'
                    ? Server
                    : item.type === 'volume' || item.type === 'block_volume' || item.type === 'block_ssd'
                    ? HardDrive
                    : Globe;

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectResource(item.id)}
                    className={`cursor-pointer transition-colors ${
                      isProtected
                        ? 'bg-cyan-950/15 hover:bg-cyan-950/25'
                        : isZombie
                        ? 'bg-rose-950/10 hover:bg-rose-950/20'
                        : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Resource Name & ID */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-md border shrink-0 ${
                            isProtected
                              ? 'border-cyan-500/40 bg-cyan-950/50 text-cyan-400'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-100 text-xs flex items-center space-x-1.5">
                            <span>{item.name}</span>
                            {isProtected && (
                              <span className="text-[11px]" title="Protected Peak Workload">
                                🛡️
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            {item.id} {item.team ? `• ${item.team}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Env / Region */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] uppercase font-mono font-semibold ${
                            item.env === 'prod'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                              : item.env === 'staging'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}
                        >
                          {item.env}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {item.region?.replace('in-', '')}
                        </span>
                      </div>
                    </td>

                    {/* CURRENT SPEC Column (Properly Rendered) */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderCurrentSpec(item)}
                    </td>

                    {/* Tariff */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-zinc-100 text-xs whitespace-nowrap">
                      {formatINR(item.monthly_cost_inr)}
                    </td>

                    {/* CPU Utilization Story (No Wall of Decimals) */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {item.type === 'vm' ? (
                        renderMetricStory(
                          item.metrics_summary.cpu_avg,
                          item.metrics_summary.cpu_p50,
                          item.metrics_summary.cpu_p95,
                          item.metrics_summary.cpu_p99,
                          'cpu'
                        )
                      ) : (
                        <span className="text-[11px] text-zinc-600 font-mono">—</span>
                      )}
                    </td>

                    {/* RAM Utilization Story (No Wall of Decimals) */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {item.type === 'vm' ? (
                        renderMetricStory(
                          item.metrics_summary.mem_avg,
                          item.metrics_summary.mem_p50,
                          item.metrics_summary.mem_p95,
                          item.metrics_summary.mem_p99,
                          'mem'
                        )
                      ) : (
                        <span className="text-[11px] text-zinc-600 font-mono">—</span>
                      )}
                    </td>

                    {/* FinOps Recommendation Status Badge & Subtext */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderHumanStatus(item)}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectResource(item.id);
                        }}
                        className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-700 transition-colors shadow-xs"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
