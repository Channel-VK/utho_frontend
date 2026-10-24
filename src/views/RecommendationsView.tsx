import React, { useState } from 'react';
import {
  Check,
  X,
  HardDrive,
  Clock,
  AlertTriangle,
  Download,
  CheckCheck,
  Filter,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import type { Recommendation, RecommendationsSummary, ActionType, RiskLevel } from '../types/api';
import { formatINR } from '../utils/format';
import { MondayRunbookStrip } from '../components/common/MondayRunbookStrip';

interface RecommendationsViewProps {
  recommendations: Recommendation[];
  summary: RecommendationsSummary;
  initialFilterAction?: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onBulkAcceptLowRisk: () => void;
  onAcceptCategory?: (category: 'orphan' | 'off_hours' | 'rightsize') => void;
  onOpenExportModal: () => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  recommendations,
  summary,
  initialFilterAction = 'ALL',
  onAccept,
  onReject,
  onBulkAcceptLowRisk,
  onAcceptCategory,
  onOpenExportModal,
}) => {
  const [filterAction, setFilterAction] = useState<string>(initialFilterAction);
  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredItems = recommendations.filter((item) => {
    // Action filter (handles aliases like SCHEDULE_OFF_HOURS & OFF_HOURS_SHUTDOWN)
    if (filterAction !== 'ALL') {
      if (filterAction === 'RIGHTSIZE_VM' && item.action_type !== 'RIGHTSIZE_VM') return false;
      if (
        filterAction === 'OFF_HOURS' &&
        item.action_type !== 'SCHEDULE_OFF_HOURS' &&
        item.action_type !== 'OFF_HOURS_SHUTDOWN'
      )
        return false;
      if (
        filterAction === 'ORPHAN' &&
        item.action_type !== 'CLEANUP_ORPHAN' &&
        item.action_type !== 'CLEAN_ORPHANED_VOLUME' &&
        item.action_type !== 'CLEAN_ORPHANED_IP'
      )
        return false;
      if (
        filterAction === 'ZOMBIE' &&
        item.action_type !== 'TERMINATE_ZOMBIE' &&
        item.action_type !== 'TERMINATE_ZOMBIE_VM'
      )
        return false;
    }

    if (filterRisk !== 'ALL' && item.risk_level !== filterRisk) return false;
    return !(filterStatus !== 'ALL' && item.status !== filterStatus);

  });

  const getActionBadge = (action: ActionType) => {
    switch (action) {
      case 'RIGHTSIZE_VM':
        return (
          <span className="inline-flex items-center space-x-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
            <Zap className="h-3 w-3 text-emerald-400" />
            <span>Rightsize VM</span>
          </span>
        );
      case 'OFF_HOURS_SHUTDOWN':
      case 'SCHEDULE_OFF_HOURS':
        return (
          <span className="inline-flex items-center space-x-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
            <Clock className="h-3 w-3 text-indigo-400" />
            <span>Off-Hours Schedule</span>
          </span>
        );
      case 'CLEAN_ORPHANED_VOLUME':
      case 'CLEAN_ORPHANED_IP':
      case 'CLEANUP_ORPHAN':
        return (
          <span className="inline-flex items-center space-x-1.5 rounded-full border border-rose-500/30 bg-rose-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
            <HardDrive className="h-3 w-3 text-rose-400" />
            <span>Purge Orphan</span>
          </span>
        );
      case 'TERMINATE_ZOMBIE':
      case 'TERMINATE_ZOMBIE_VM':
        return (
          <span className="inline-flex items-center space-x-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
            <AlertTriangle className="h-3 w-3 text-amber-400" />
            <span>Terminate Zombie</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
            <span>{action}</span>
          </span>
        );
    }
  };

  const getRiskBadge = (risk: RiskLevel, confidence?: number) => {
    const score = confidence ?? 95;
    const color =
      risk === 'LOW'
        ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-400'
        : risk === 'MEDIUM'
        ? 'border-amber-500/30 bg-amber-950/30 text-amber-400'
        : 'border-rose-500/30 bg-rose-950/30 text-rose-400';

    return (
      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-mono font-medium ${color}`}>
        {risk} • {score}% CONF
      </span>
    );
  };

  const handleCategoryAction = (category: 'orphan' | 'off_hours' | 'rightsize') => {
    if (onAcceptCategory) {
      onAcceptCategory(category);
    } else {
      const targetItems = recommendations.filter((r) => {
        if (category === 'orphan') {
          return (
            (r.action_type === 'CLEANUP_ORPHAN' ||
              r.action_type === 'CLEAN_ORPHANED_VOLUME' ||
              r.action_type === 'CLEAN_ORPHANED_IP') &&
            r.status === 'pending'
          );
        }
        if (category === 'off_hours') {
          return (
            (r.action_type === 'SCHEDULE_OFF_HOURS' ||
              r.action_type === 'OFF_HOURS_SHUTDOWN') &&
            r.status === 'pending'
          );
        }
        return r.action_type === 'RIGHTSIZE_VM' && r.status === 'pending';
      });

      targetItems.forEach((item) => onAccept(item.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Action Plan & Rightsizing Recommendations Ledger
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Verified candidate adjustments with mathematical proof formulas, Jev capacity risk checks, and diurnal low-load windows.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onBulkAcceptLowRisk}
            className="flex items-center space-x-1.5 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/50 transition-colors shadow-xs"
          >
            <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Accept All Low-Risk</span>
          </button>

          <button
            onClick={onOpenExportModal}
            className="flex items-center space-x-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5 text-zinc-400" />
            <span>Export CLI / Terraform</span>
          </button>
        </div>
      </div>

      {/* Monday Morning 3-Step Runbook Quick-Execution Cards */}
      <MondayRunbookStrip
        recommendations={recommendations}
        onAcceptCategory={handleCategoryAction}
        onFilterRightsizing={() => setFilterAction('RIGHTSIZE_VM')}
      />

      {/* Filter Ribbon Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-xs text-zinc-400 mr-2">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-medium">Filter Action Plan:</span>
          </div>

          {/* Quick Category Buttons */}
          <div className="flex items-center rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-xs font-medium">
            <button
              onClick={() => setFilterAction('ALL')}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterAction === 'ALL'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({recommendations.length})
            </button>
            <button
              onClick={() => setFilterAction('RIGHTSIZE_VM')}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterAction === 'RIGHTSIZE_VM'
                  ? 'bg-zinc-800 text-emerald-300 shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Rightsizing
            </button>
            <button
              onClick={() => setFilterAction('OFF_HOURS')}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterAction === 'OFF_HOURS'
                  ? 'bg-zinc-800 text-indigo-300 shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Off-Hours
            </button>
            <button
              onClick={() => setFilterAction('ORPHAN')}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterAction === 'ORPHAN'
                  ? 'bg-zinc-800 text-rose-300 shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Orphans
            </button>
            <button
              onClick={() => setFilterAction('ZOMBIE')}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterAction === 'ZOMBIE'
                  ? 'bg-zinc-800 text-amber-300 shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Zombies
            </button>
          </div>

          {/* Risk Level Selector */}
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:outline-hidden"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">LOW Risk Only</option>
            <option value="MEDIUM">MEDIUM Risk</option>
            <option value="HIGH">HIGH Risk</option>
          </select>

          {/* Status Selector */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:outline-hidden"
          >
            <option value="ALL">All Commit States</option>
            <option value="pending">Pending Review</option>
            <option value="accepted">Accepted / Committed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="text-xs text-zinc-400 font-mono">
          Showing <strong className="text-zinc-200">{filteredItems.length}</strong> items •{' '}
          <span className="text-emerald-400 font-semibold">{summary.accepted_count} committed</span>
        </div>
      </div>

      {/* Spacious Interactive Recommendations Ledger Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-4 py-3.5">Resource & Region</th>
                <th className="px-4 py-3.5">Action Type</th>
                <th className="px-4 py-3.5">Specification Delta</th>
                <th className="px-4 py-3.5">Explicit Formula String</th>
                <th className="px-4 py-3.5">Technical Proof & AI Window</th>
                <th className="px-4 py-3.5">Risk & Confidence</th>
                <th className="px-4 py-3.5 text-right">Yield (₹/mo)</th>
                <th className="px-4 py-3.5 text-center">Commit Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {filteredItems.map((rec) => {
                const isAccepted = rec.status === 'accepted';
                const isRejected = rec.status === 'rejected';

                const currentConfig = rec.current_config || rec.current_spec || 'Current Spec';
                const recommendedConfig =
                  rec.recommended_config || rec.target_spec || 'Optimized Spec';
                const formulaStr =
                  rec.formula_explanation || rec.formula_string || '₹ Current - ₹ Target = Savings';
                const proofStr = rec.reason || rec.peak_proof || 'Safe headroom validated';
                const confidence = rec.confidence_score ?? rec.confidence_pct ?? 95;
                const isOffHours =
                  rec.action_type === 'SCHEDULE_OFF_HOURS' ||
                  rec.action_type === 'OFF_HOURS_SHUTDOWN';

                return (
                  <tr
                    key={rec.id}
                    className={`transition-colors ${
                      isAccepted
                        ? 'bg-emerald-950/15 hover:bg-emerald-950/25'
                        : isRejected
                        ? 'opacity-60 bg-zinc-950/40 hover:bg-zinc-950/60'
                        : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Resource Name */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-zinc-100 text-xs">
                        {rec.resource_name}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        {rec.resource_id} • {rec.region} ({rec.env})
                      </div>
                    </td>

                    {/* Action Badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getActionBadge(rec.action_type)}
                    </td>

                    {/* Spec Delta */}
                    <td className="px-4 py-3.5">
                      <div className="text-zinc-400 text-[11px] line-through font-mono">
                        {currentConfig}
                      </div>
                      <div className="text-emerald-400 text-xs font-semibold font-mono mt-0.5">
                        {recommendedConfig}
                      </div>
                    </td>

                    {/* Explicit Formula */}
                    <td className="px-4 py-3.5">
                      <div className="rounded bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 border border-zinc-800 font-mono max-w-xs whitespace-normal leading-relaxed">
                        {formulaStr}
                      </div>
                    </td>

                    {/* Technical Peak Proof + AI Low-Load Window / Jev Badge */}
                    <td className="px-4 py-3.5 text-[11px] text-zinc-400 max-w-xs leading-relaxed space-y-1">
                      <div>{proofStr}</div>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                        {isOffHours ? (
                          <span className="inline-flex items-center space-x-1 rounded border border-indigo-500/30 bg-indigo-950/30 px-1.5 py-0.2 text-indigo-300">
                            <Clock className="h-2.5 w-2.5" />
                            <span>Window: 20:00–08:00 IST</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 rounded border border-emerald-500/30 bg-emerald-950/25 px-1.5 py-0.2 text-emerald-300">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            <span>Jev Risk &lt; 20%</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Risk & Confidence */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getRiskBadge(rec.risk_level, confidence)}
                    </td>

                    {/* Savings Yield */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400 text-xs whitespace-nowrap">
                      +{formatINR(rec.monthly_savings_inr)}
                    </td>

                    {/* Accept / Reject Toggles */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
                      <div className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-950 p-0.5 shadow-xs">
                        <button
                          onClick={() => onAccept(rec.id)}
                          className={`flex items-center space-x-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            isAccepted
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800'
                          }`}
                          title="Accept and queue for automated remediation"
                        >
                          <Check className="h-3 w-3" />
                          <span>{isAccepted ? 'Accepted' : 'Accept'}</span>
                        </button>

                        <button
                          onClick={() => onReject(rec.id)}
                          className={`flex items-center space-x-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                            isRejected
                              ? 'bg-zinc-700 text-rose-300'
                              : 'text-zinc-500 hover:text-rose-400 hover:bg-zinc-800'
                          }`}
                          title="Reject recommendation"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
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
