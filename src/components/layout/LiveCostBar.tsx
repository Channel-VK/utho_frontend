import React from 'react';
import { ArrowRight, CheckCheck, Download, Zap } from 'lucide-react';
import { formatINR } from '../../utils/format';

interface LiveCostBarProps {
  currentMonthlyInr: number;
  projectedMonthlyInr: number;
  acceptedSavingsInr: number;
  acceptedSavingsPct: number;
  acceptedCount: number;
  pendingLowRiskCount: number;
  onBulkAcceptLowRisk: () => void;
  onOpenExportModal: () => void;
}

export const LiveCostBar: React.FC<LiveCostBarProps> = ({
  currentMonthlyInr,
  projectedMonthlyInr,
  acceptedSavingsInr,
  acceptedSavingsPct,
  pendingLowRiskCount,
  onBulkAcceptLowRisk,
  onOpenExportModal,
}) => {
  return (
    <div className="sticky top-14 z-30 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6 whitespace-nowrap gap-4">
        {/* Left: Current Bill -> After Plan + Green Pill */}
        <div className="flex items-center space-x-3 text-xs overflow-x-auto scrollbar-none py-1">
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-zinc-400 font-medium">Current Bill:</span>
            <span className="font-mono text-zinc-200 font-semibold text-sm">
              {formatINR(currentMonthlyInr)}
              <span className="text-[11px] font-normal text-zinc-500">/mo</span>
            </span>
          </div>

          <ArrowRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />

          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-zinc-400 font-medium">After Plan:</span>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              {formatINR(projectedMonthlyInr)}
              <span className="text-[11px] font-normal text-emerald-500/70">/mo</span>
            </span>
          </div>

          {/* Green Pill */}
          <div className="flex items-center space-x-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-xs text-emerald-400 shrink-0 font-medium">
            <Zap className="h-3 w-3 text-emerald-400 fill-emerald-400" />
            <span>
              Saving <strong className="font-mono font-bold">{formatINR(acceptedSavingsInr)}/mo</strong>{' '}
              <span className="text-emerald-300 font-mono text-[11px]">(-{acceptedSavingsPct}%)</span>
            </span>
          </div>
        </div>

        {/* Right: Same horizontal line - Accept Low-Risk & Export buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {pendingLowRiskCount > 0 && (
            <button
              onClick={onBulkAcceptLowRisk}
              className="flex items-center space-x-1.5 rounded-md border border-emerald-600/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-500 hover:bg-emerald-900/50 transition-colors shadow-xs shrink-0"
            >
              <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Accept All Low-Risk ({pendingLowRiskCount})</span>
            </button>
          )}

          <button
            onClick={onOpenExportModal}
            className="flex items-center space-x-1.5 rounded-md border border-zinc-700 bg-zinc-800/90 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-700 transition-colors shadow-xs shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-zinc-400" />
            <span>Export CLI / Terraform</span>
          </button>
        </div>
      </div>
    </div>
  );
};
