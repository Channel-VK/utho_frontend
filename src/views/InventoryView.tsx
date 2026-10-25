import React, { useState } from 'react';
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

  const filtered = resources.filter((r) => {
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

    if (envFilter !== 'ALL' && r.env.toLowerCase() !== envFilter.toLowerCase()) return false;

    if (regionFilter !== 'ALL') {
      if (regionFilter === 'Noida' && !r.region.includes('noida')) return false;
      if (regionFilter === 'Bangalore' && !r.region.includes('bangalore')) return false;
      if (regionFilter === 'Mumbai' && !r.region.includes('mumbai')) return false;
    }

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

  const renderCurrentSpec = (r: Resource) => {
    if (r.type === 'vm') {
      const planName = r.plan || r.current_spec?.split(' ')[0] || 'm8.xlarge';
      const vcpu = r.vcpu ?? 4;
      const ram = r.ram_gb ?? 16;
      return (
        <div>
          <div className="font-semibold text-[#111318] font-sans text-xs">{planName}</div>
          <div className="text-[11px] text-[#68707E] mt-0.5 font-sans tabular-nums">
            {vcpu} vCPU · {ram} GB RAM
          </div>
        </div>
      );
    }

    if (r.type === 'volume' || r.type === 'block_volume' || r.type === 'block_ssd') {
      const size = r.disk_gb || 500;
      return (
        <div>
          <div className="font-semibold text-[#111318] text-xs">Block SSD</div>
          <div className="text-[11px] text-[#68707E] mt-0.5 font-sans tabular-nums">{size} GB NVMe</div>
        </div>
      );
    }

    return (
      <div>
        <div className="font-semibold text-[#111318] text-xs">Public IPv4</div>
        <div className="text-[11px] text-[#68707E] mt-0.5 font-mono">{r.ip_address || 'Unattached'}</div>
      </div>
    );
  };

  const renderHumanStatus = (r: Resource) => {
    const status = r.optimization_status;
    const cpuAvg = Math.round(r.metrics_summary?.cpu_avg || 0);
    const cpuP99 = Math.round(r.metrics_summary?.cpu_p99 || 0);

    switch (status) {
      case 'PROTECTED_PEAK_LOAD':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex rounded-md status-yellow px-2.5 py-0.5 text-[11px] font-semibold">
              Peak Protected (Keep Size)
            </span>
            <div className="text-[10px] text-[#7C4F14] font-sans tabular-nums">
              {cpuAvg}% avg, {cpuP99}% daily peak
            </div>
          </div>
        );

      case 'OVERPROVISIONED':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex rounded-md status-green px-2.5 py-0.5 text-[11px] font-semibold">
              Downsize Ready
            </span>
            <div className="text-[10px] text-[#525866]">
              Peak &lt; 25% — Downsize to save
            </div>
          </div>
        );

      case 'IDLE_SCHEDULE_CANDIDATE':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex rounded-md status-yellow px-2.5 py-0.5 text-[11px] font-semibold">
              Off-Hours Schedule
            </span>
            <div className="text-[10px] text-[#525866]">
              Idle 118 hrs/wk (Nights/Wknd)
            </div>
          </div>
        );

      case 'ORPHANED':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex rounded-md status-red px-2.5 py-0.5 text-[11px] font-semibold">
              Orphaned Waste
            </span>
            <div className="text-[10px] text-[#525866]">
              Unattached — 0 IOPS
            </div>
          </div>
        );

      case 'ZOMBIE':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex rounded-md status-red px-2.5 py-0.5 text-[11px] font-semibold">
              Zombie VM
            </span>
            <div className="text-[10px] text-[#525866]">
              Idle 90+ days (&lt;3% CPU)
            </div>
          </div>
        );

      case 'OPTIMAL':
      default:
        return (
          <div className="space-y-0.5">
            <span className="inline-flex rounded-md glass-pill-neutral px-2.5 py-0.5 text-[11px] font-semibold">
              Right-Sized
            </span>
            <div className="text-[10px] text-[#68707E]">Operating within SLA</div>
          </div>
        );
    }
  };

  const renderMetricStory = (avgVal: number, p99Val: number) => {
    const avg = Math.round(avgVal);
    const peak = Math.round(p99Val);

    const barFillColor =
      peak >= 85
        ? 'bg-[#9E2F2B]'
        : peak >= 60
        ? 'bg-[#94601B]'
        : 'bg-[#236B52]';

    return (
      <div className="w-36 space-y-1">
        <div className="flex justify-between items-baseline text-xs font-sans tabular-nums">
          <span className="text-[#525866] text-[11px]">Avg {avg}%</span>
          <span className="font-bold text-[#111318]">Peak {peak}%</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className={`h-full ${barFillColor}`}
            style={{ width: `${Math.min(100, Math.max(4, peak))}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.07] pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111318]">
            Full Fleet Resource Matrix &amp; Peak-Safety Inspector
          </h1>
          <p className="text-xs text-[#525866] mt-0.5">
            Complete 85-resource Utho Cloud telemetry inventory across Mumbai, Bangalore, and Noida.
          </p>
        </div>
        <div className="font-sans text-xs text-[#525866]">
          Showing <strong className="text-[#111318] tabular-nums">{filtered.length}</strong> of <span className="tabular-nums">{resources.length}</span> resources
        </div>
      </div>

      {/* Triage Pills & Filters Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl glass-card p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL' as const, label: `All (${countAll})` },
            { id: 'NEEDS_ACTION' as const, label: `Needs Action (${countNeedsAction})` },
            { id: 'PEAK_PROTECTED' as const, label: `Peak Protected (${countPeakProtected})` },
            { id: 'ORPHANED' as const, label: `Orphaned (${countOrphaned})` },
            { id: 'OFF_HOURS' as const, label: `Off-Hours (${countOffHours})` },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setTriageFilter(btn.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                triageFilter === btn.id
                  ? 'bg-[#111318] text-white'
                  : 'glass-well text-[#525866] hover:text-[#111318]'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, ID, or spec..."
            className="w-48 rounded-lg bg-white/80 border border-black/[0.08] px-3 py-1.5 text-xs text-[#111318] placeholder:text-[#68707E] focus:outline-hidden"
          />

          <div className="flex items-center rounded-lg glass-well p-0.5 text-[11px] font-sans">
            {['ALL', 'prod', 'staging', 'dev'].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEnvFilter(e)}
                className={`rounded-md px-2 py-1 uppercase font-semibold transition-colors ${
                  envFilter.toLowerCase() === e.toLowerCase()
                    ? 'bg-[#111318] text-white'
                    : 'text-[#525866] hover:text-[#111318]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-lg glass-well p-0.5 text-[11px] font-sans">
            {['ALL', 'Mumbai', 'Bangalore', 'Noida'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegionFilter(r)}
                className={`rounded-md px-2 py-1 font-semibold transition-colors ${
                  regionFilter === r
                    ? 'bg-[#111318] text-white'
                    : 'text-[#525866] hover:text-[#111318]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl glass-card">
        <div
          tabIndex={0}
          role="region"
          aria-label="Full Fleet Resource Inventory Table"
          className="table-wrapper"
        >
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#525866] font-label-caps text-label-caps uppercase">
                <th className="px-4 py-3">Resource Name &amp; ID</th>
                <th className="px-4 py-3">Env / Region</th>
                <th className="px-4 py-3">Hardware Spec</th>
                <th className="px-4 py-3 text-right">Monthly Spend</th>
                <th className="px-4 py-3">CPU (Avg / Peak)</th>
                <th className="px-4 py-3">RAM (Avg / Peak)</th>
                <th className="px-4 py-3">FinOps Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelectResource(item.id)}
                  className="cursor-pointer hover:bg-black/[0.025] transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-[#111318] text-xs font-sans">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-[#68707E] font-mono mt-0.5">
                      {item.id} {item.team ? `· ${item.team}` : ''}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md px-2 py-0.5 text-[10px] uppercase font-sans font-bold glass-pill-neutral">
                        {item.env}
                      </span>
                      <span className="text-[11px] text-[#525866] font-sans">
                        {item.region}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 whitespace-nowrap">{renderCurrentSpec(item)}</td>

                  <td className="px-4 py-3.5 text-right font-sans font-bold tabular-nums text-[#111318] text-xs whitespace-nowrap">
                    {formatINR(item.monthly_cost_inr)}
                  </td>

                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {item.type === 'vm' ? (
                      renderMetricStory(
                        item.metrics_summary.cpu_avg,
                        item.metrics_summary.cpu_p99
                      )
                    ) : (
                      <span className="text-[11px] text-[#68707E] font-sans tabular-nums">0% (Storage/IP)</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {item.type === 'vm' ? (
                      renderMetricStory(
                        item.metrics_summary.mem_avg,
                        item.metrics_summary.mem_p99
                      )
                    ) : (
                      <span className="text-[11px] text-[#68707E] font-sans">Unmounted</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 whitespace-nowrap">{renderHumanStatus(item)}</td>

                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectResource(item.id);
                      }}
                      className="rounded-lg bg-[#111318] hover:bg-[#272B33] px-3 py-1 text-xs font-semibold text-white transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
