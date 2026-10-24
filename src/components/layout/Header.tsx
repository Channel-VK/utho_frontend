import React from 'react';

export type ActiveTab =
  | 'dashboard'
  | 'simulator'
  | 'recommendations'
  | 'inventory'
  | 'assumptions';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onQuickCategorySelect?: (category: 'ALL' | 'FLAGGED' | 'COMPUTE' | 'STORAGE' | 'PROTECTED') => void;
  activeResourceCategory?: string;
  isConnected: boolean;
  isAIConnected?: boolean;
  isChecking: boolean;
  onCheckConnection: () => void;
  activeAlertsCount: number;
  pendingRecsCount: number;
  pendingLowRiskCount?: number;
  onBulkAcceptLowRisk?: () => void;
  onOpenExportModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onQuickCategorySelect,
  activeResourceCategory = 'ALL',
  isConnected,
  isAIConnected = false,
  isChecking,
  onCheckConnection,
  activeAlertsCount,
  pendingRecsCount,
  pendingLowRiskCount = 0,
  onBulkAcceptLowRisk,
  onOpenExportModal,
}) => {
  const screenTitle =
    activeTab === 'dashboard'
      ? 'Cloud Spending & Server Usage'
      : activeTab === 'simulator'
      ? 'Simulator & Alerts'
      : activeTab === 'recommendations'
      ? 'Recommendations & Pricing'
      : activeTab === 'inventory'
      ? 'Full Fleet Inventory (85 Resources)'
      : 'Optimization Governance & Pricing Math';

  const isSpendingAll =
    activeTab === 'dashboard' &&
    activeResourceCategory !== 'COMPUTE' &&
    activeResourceCategory !== 'STORAGE';
  const isComputeActive = activeTab === 'dashboard' && activeResourceCategory === 'COMPUTE';
  const isStorageActive = activeTab === 'dashboard' && activeResourceCategory === 'STORAGE';

  return (
    <>
      {/* LEFT PERSISTENT GLASS SIDEBAR */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white/75 backdrop-blur-2xl border-r border-black/[0.07] z-50 flex flex-col justify-between shadow-[0_1px_12px_rgba(17,19,24,0.03)]">
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* App Brand */}
          <div
            onClick={() => {
              onQuickCategorySelect?.('ALL');
              onTabChange('dashboard');
            }}
            className="h-16 px-6 flex items-center justify-between border-b border-black/[0.06] cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#111318] flex items-center justify-center font-bold text-white text-xs tracking-wider shadow-xs">
                CO
              </div>
              <span className="font-semibold text-[16px] text-[#111318] tracking-tight">
                CloudOpt
              </span>
            </div>
            <span className="text-[10px] uppercase font-mono font-semibold tracking-widest text-[#4A505C] glass-pill-neutral px-2 py-0.5 rounded-md">
              FinSort
            </span>
          </div>

          {/* Workspace Switcher */}
          <div className="p-4">
            <div
              onClick={() => onTabChange('recommendations')}
              className="p-3 rounded-xl glass-well hover:bg-black/[0.05] transition-colors cursor-pointer"
            >
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[#767D8C]">
                Workspace
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-semibold text-[#111318]">
                  Engineering &amp; Finance
                </span>
                <span className="text-[10px] text-[#4A505C] font-mono font-semibold bg-white/80 px-1.5 py-0.5 rounded border border-black/[0.07]">
                  INR
                </span>
              </div>
            </div>
          </div>

          {/* Section Label */}
          <div className="px-6 pb-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#767D8C]">
              Platform Navigation
            </span>
          </div>

          {/* Navigation Links (Minimalist Monochrome + Blended Status Pills) */}
          <nav className="flex-1 px-3 space-y-1">
            <button
              type="button"
              onClick={() => {
                onQuickCategorySelect?.('ALL');
                onTabChange('dashboard');
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                isSpendingAll
                  ? 'font-semibold text-white bg-[#111318] shadow-xs'
                  : 'font-medium text-[#4A505C] hover:text-[#111318] hover:bg-black/[0.04]'
              }`}
            >
              <span>Cloud Spending</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                  isSpendingAll
                    ? 'bg-white/15 text-white'
                    : 'status-green'
                }`}
              >
                ₹ Live
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('simulator')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                activeTab === 'simulator'
                  ? 'font-semibold text-white bg-[#111318] shadow-xs'
                  : 'font-medium text-[#4A505C] hover:text-[#111318] hover:bg-black/[0.04]'
              }`}
            >
              <span>Simulator &amp; Alerts</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                  activeTab === 'simulator'
                    ? 'bg-white/15 text-white'
                    : activeAlertsCount > 0
                    ? 'status-red'
                    : 'status-green'
                }`}
              >
                {activeAlertsCount > 0 ? `${activeAlertsCount} Active` : 'Nominal'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('recommendations')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                activeTab === 'recommendations'
                  ? 'font-semibold text-white bg-[#111318] shadow-xs'
                  : 'font-medium text-[#4A505C] hover:text-[#111318] hover:bg-black/[0.04]'
              }`}
            >
              <span>Recommendations &amp; Pricing</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                  activeTab === 'recommendations'
                    ? 'bg-white/15 text-white'
                    : pendingRecsCount > 0
                    ? 'status-yellow'
                    : 'status-green'
                }`}
              >
                {pendingRecsCount} Pending
              </span>
            </button>

            <div className="px-3 pt-4 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#767D8C]">
                Fleet Views &amp; Filters
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onQuickCategorySelect?.('COMPUTE');
                onTabChange('dashboard');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                isComputeActive
                  ? 'font-semibold text-white bg-[#111318] shadow-xs'
                  : 'font-medium text-[#4A505C] hover:text-[#111318] hover:bg-black/[0.04]'
              }`}
            >
              <span>Compute Instances</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-medium ${
                  isComputeActive ? 'bg-white/15 text-white' : 'glass-pill-neutral'
                }`}
              >
                VM Fleet
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onQuickCategorySelect?.('STORAGE');
                onTabChange('dashboard');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                isStorageActive
                  ? 'font-semibold text-white bg-[#111318] shadow-xs'
                  : 'font-medium text-[#4A505C] hover:text-[#111318] hover:bg-black/[0.04]'
              }`}
            >
              <span>Storage &amp; Volumes</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-medium ${
                  isStorageActive ? 'bg-white/15 text-white' : 'glass-pill-neutral'
                }`}
              >
                SSD &amp; IP
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('inventory')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                activeTab === 'inventory'
                  ? 'font-semibold text-white bg-[#111318] shadow-xs'
                  : 'font-medium text-[#4A505C] hover:text-[#111318] hover:bg-black/[0.04]'
              }`}
            >
              <span>Full Fleet Matrix</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-medium ${
                  activeTab === 'inventory' ? 'bg-white/15 text-white' : 'glass-pill-neutral'
                }`}
              >
                85 Nodes
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('assumptions')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                activeTab === 'assumptions'
                  ? 'font-semibold text-white bg-[#111318] shadow-xs'
                  : 'font-medium text-[#4A505C] hover:text-[#111318] hover:bg-black/[0.04]'
              }`}
            >
              <span>Governance &amp; Math</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-medium ${
                  activeTab === 'assumptions' ? 'bg-white/15 text-white' : 'glass-pill-neutral'
                }`}
              >
                Formulas
              </span>
            </button>
          </nav>
        </div>

        {/* Service Telemetry & User Profile Footer */}
        <div className="p-4 border-t border-black/[0.06] bg-white/40 space-y-2.5">
          {/* Blended Status Pills for Live Backend Services */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onCheckConnection}
              disabled={isChecking}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-center transition-all ${
                isConnected ? 'status-green' : 'status-yellow'
              }`}
            >
              {isConnected ? 'Go :8080 Live' : 'Go :8080 Sync'}
            </button>
            <button
              type="button"
              onClick={onCheckConnection}
              disabled={isChecking}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-center transition-all ${
                isAIConnected ? 'status-green' : 'status-yellow'
              }`}
            >
              {isAIConnected ? 'AI :8001 Live' : 'AI :8001 Sync'}
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/75 border border-black/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#111318] text-white flex items-center justify-center text-[11px] font-semibold font-mono">
                AR
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#111318]">Alex Rivera</span>
                <span className="text-[10px] text-[#767D8C] font-mono">Lead DevSecOps</span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold status-green px-2 py-0.5 rounded-md">
              Online
            </span>
          </div>
        </div>
      </aside>

      {/* TOP STICKY GLASS CONTEXT BAR */}
      <header className="fixed top-0 left-64 right-0 h-14 bg-white/72 backdrop-blur-2xl border-b border-black/[0.07] z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[15px] font-semibold text-[#111318] tracking-tight truncate">
            {screenTitle}
          </h1>
          <span className="px-2.5 py-0.5 rounded-md status-green text-[11px] font-mono font-semibold uppercase tracking-wider shrink-0">
            Telemetry Synced
          </span>
          <span className="hidden md:inline-flex px-2.5 py-0.5 rounded-md glass-pill-neutral text-[11px] font-mono font-medium shrink-0">
            in-mumbai-1 · in-bangalore-1 · in-noida-1
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingLowRiskCount > 0 && onBulkAcceptLowRisk && (
            <button
              type="button"
              onClick={onBulkAcceptLowRisk}
              className="px-3.5 py-1.5 rounded-xl status-green hover:bg-[#236B52]/18 text-xs font-semibold transition-all"
            >
              Approve Low-Risk ({pendingLowRiskCount})
            </button>
          )}

          {onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              className="px-3.5 py-1.5 rounded-xl bg-[#111318] hover:bg-[#232730] text-white text-xs font-semibold transition-all shadow-xs"
            >
              Export Terraform &amp; CLI
            </button>
          )}
        </div>
      </header>
    </>
  );
};
