import React from 'react';
import { Trash2, Clock, ShieldCheck, CheckCheck, ArrowRight } from 'lucide-react';
import type { Recommendation } from '../../types/api';
import { formatINR } from '../../utils/format';

interface MondayRunbookStripProps {
  recommendations: Recommendation[];
  protectedCount?: number;
  onAcceptCategory: (category: 'orphan' | 'off_hours' | 'rightsize') => void;
  onFilterRightsizing?: () => void;
}

export const MondayRunbookStrip: React.FC<MondayRunbookStripProps> = ({
  recommendations,
  protectedCount = 10,
  onAcceptCategory,
  onFilterRightsizing,
}) => {
  // Step 1: Orphan Disks & IPs
  const orphanRecs = recommendations.filter(
    (r) =>
      r.action_type === 'CLEANUP_ORPHAN' ||
      r.action_type === 'CLEAN_ORPHANED_VOLUME' ||
      r.action_type === 'CLEAN_ORPHANED_IP'
  );
  const orphanSavings = orphanRecs.reduce((sum, r) => sum + r.monthly_savings_inr, 0);
  const orphanPendingCount = orphanRecs.filter((r) => r.status === 'pending').length;

  // Step 2: Off-Hours Shutdown
  const offHoursRecs = recommendations.filter(
    (r) =>
      r.action_type === 'SCHEDULE_OFF_HOURS' ||
      r.action_type === 'OFF_HOURS_SHUTDOWN'
  );
  const offHoursSavings = offHoursRecs.reduce((sum, r) => sum + r.monthly_savings_inr, 0);
  const offHoursPendingCount = offHoursRecs.filter((r) => r.status === 'pending').length;

  // Step 3: Peak-Safe Rightsizing
  const rightsizeRecs = recommendations.filter((r) => r.action_type === 'RIGHTSIZE_VM');
  const rightsizeSavings = rightsizeRecs.reduce((sum, r) => sum + r.monthly_savings_inr, 0);
  const rightsizePendingCount = rightsizeRecs.filter((r) => r.status === 'pending').length;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
        <div className="flex items-center space-x-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
            ☕
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
              Monday Morning Triage Runbook (Finish Before Lunch)
            </h3>
            <p className="text-[11px] text-zinc-400">
              3 prioritized execution buckets to safely unlock{' '}
              <strong className="text-emerald-400 font-sans font-bold tabular-nums">
                {formatINR(orphanSavings + offHoursSavings + rightsizeSavings)}/mo
              </strong>{' '}
              with zero service disruption.
            </p>
          </div>
        </div>

        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-sans text-zinc-400 uppercase tracking-wider self-start sm:self-auto">
          3-Step Action Plan
        </span>
      </div>

      {/* 3 Step Buckets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Step 1: Purge Orphaned Disks & Unattached IPs */}
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3.5 flex flex-col justify-between space-y-3 hover:border-zinc-700 transition-colors">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-rose-400 bg-rose-950/30 px-1.5 py-0.5 rounded border border-rose-500/20">
                Step 1 • Zero Risk • Instant
              </span>
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            </div>

            <h4 className="text-xs font-semibold text-zinc-100">
              Purge Orphaned Disks & Unattached IPs
            </h4>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {orphanRecs.length} detached block volumes and unassociated Elastic IPs accruing idle tariffs.
            </p>

            <div className="font-sans tabular-nums text-sm font-bold text-emerald-400 pt-1">
              +{formatINR(orphanSavings)}
              <span className="text-[10px] text-zinc-500 font-normal">/mo</span>
            </div>
          </div>

          <button
            onClick={() => onAcceptCategory('orphan')}
            disabled={orphanPendingCount === 0}
            className={`w-full flex items-center justify-center space-x-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors shadow-xs ${
              orphanPendingCount > 0
                ? 'border border-rose-500/30 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50'
                : 'border border-zinc-800 bg-zinc-900 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>
              {orphanPendingCount > 0
                ? `Accept All Orphan Cleanups (${orphanPendingCount})`
                : 'All Orphans Purged ✓'}
            </span>
          </button>
        </div>

        {/* Step 2: Automate Dev & Staging Off-Hours Shutdown */}
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3.5 flex flex-col justify-between space-y-3 hover:border-zinc-700 transition-colors">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-500/20">
                Step 2 • Low Risk • Scheduled
              </span>
              <Clock className="h-3.5 w-3.5 text-indigo-400" />
            </div>

            <h4 className="text-xs font-semibold text-zinc-100">
              Automate Dev & Staging Off-Hours
            </h4>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {offHoursRecs.length} non-prod workloads idle 118 hrs/week (Mon-Fri nights + full weekends).
            </p>

            <div className="font-sans tabular-nums text-sm font-bold text-emerald-400 pt-1">
              +{formatINR(offHoursSavings)}
              <span className="text-[10px] text-zinc-500 font-normal">/mo</span>
            </div>
          </div>

          <button
            onClick={() => onAcceptCategory('off_hours')}
            disabled={offHoursPendingCount === 0}
            className={`w-full flex items-center justify-center space-x-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors shadow-xs ${
              offHoursPendingCount > 0
                ? 'border border-indigo-500/30 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50'
                : 'border border-zinc-800 bg-zinc-900 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>
              {offHoursPendingCount > 0
                ? `Enable Off-Hours Schedules (${offHoursPendingCount})`
                : 'Schedules Enabled ✓'}
            </span>
          </button>
        </div>

        {/* Step 3: Peak-Safe VM Rightsizing */}
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3.5 flex flex-col justify-between space-y-3 hover:border-zinc-700 transition-colors">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-cyan-400 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-500/20">
                Step 3 • Verified p99 &lt; 85%
              </span>
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
            </div>

            <h4 className="text-xs font-semibold text-zinc-100">
              Peak-Safe VM Rightsizing
            </h4>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {rightsizeRecs.length} over-provisioned VMs.{' '}
              <strong className="text-cyan-300">
                {protectedCount} bursty prod VMs automatically excluded
              </strong>{' '}
              for peak safety.
            </p>

            <div className="font-sans tabular-nums text-sm font-bold text-emerald-400 pt-1">
              +{formatINR(rightsizeSavings)}
              <span className="text-[10px] text-zinc-500 font-normal">/mo</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (onFilterRightsizing) onFilterRightsizing();
              else onAcceptCategory('rightsize');
            }}
            className="w-full flex items-center justify-center space-x-1.5 rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/50 transition-colors shadow-xs"
          >
            <span>Review & Approve Resizes ({rightsizePendingCount} Pending)</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
