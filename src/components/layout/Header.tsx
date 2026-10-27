import React, { useState, useEffect, useRef } from 'react';
import { formatINR } from '../../utils/format';
import { apiClient } from '../../api/client';

export type ActiveTab =
  | 'dashboard'
  | 'simulator'
  | 'recommendations'
  | 'inventory'
  | 'assumptions'
  | 'copilot';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onQuickCategorySelect?: (category: 'ALL' | 'FLAGGED' | 'COMPUTE' | 'STORAGE' | 'PROTECTED') => void;
  activeResourceCategory?: string;
  isConnected?: boolean;
  isAIConnected?: boolean;
  isChecking?: boolean;
  onCheckConnection?: () => void;
  activeAlertsCount: number;
  pendingRecsCount: number;
  pendingLowRiskCount?: number;
  onBulkAcceptLowRisk?: () => void;
  onOpenExportModal?: () => void;
  onExportReport?: () => void;
  currentSpendInr?: number;
  acceptedSavingsInr?: number;
  projectedSpendInr?: number;
  acceptedSavingsPct?: number;
  totalPotentialSavingsInr?: number;
  onToggleChatbotPopup?: () => void;
  isChatbotPopupOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onQuickCategorySelect,
  activeResourceCategory = 'ALL',
  activeAlertsCount,
  pendingRecsCount,
  pendingLowRiskCount = 0,
  onBulkAcceptLowRisk,
  onOpenExportModal,
  onExportReport,
  currentSpendInr = 683200,
  acceptedSavingsInr = 0,
  projectedSpendInr = 683200,
  acceptedSavingsPct = 0.0,
  totalPotentialSavingsInr = 277230,
  onToggleChatbotPopup,
  isChatbotPopupOpen = false,
}) => {
  const screenTitle =
    activeTab === 'dashboard'
      ? 'Fleet Spend & Utilization'
      : activeTab === 'simulator'
      ? 'Scenario Simulator & Alerts'
      : activeTab === 'recommendations'
      ? 'Actionable Recommendations'
      : activeTab === 'inventory'
      ? 'Infrastructure Inventory (85 Nodes)'
      : activeTab === 'copilot'
      ? 'FinOps Copilot'
      : 'Pricing & Governance Math';

  const isSpendingAll =
    activeTab === 'dashboard' &&
    activeResourceCategory !== 'COMPUTE' &&
    activeResourceCategory !== 'STORAGE';
  const isComputeActive = activeTab === 'dashboard' && activeResourceCategory === 'COMPUTE';
  const isStorageActive = activeTab === 'dashboard' && activeResourceCategory === 'STORAGE';

  const [llmHealth, setLlmHealth] = useState<{
    status: string;
    api_key_configured: boolean;
    masked_key?: string;
    live_call_success: boolean;
    active_model?: string;
    sample_response?: string;
    latency_ms?: number;
    error?: string;
  } | null>(null);
  const [isCheckingLLM, setIsCheckingLLM] = useState<boolean>(false);
  const [showLLMDropdown, setShowLLMDropdown] = useState<boolean>(false);
  const llmDropdownRef = useRef<HTMLDivElement>(null);

  const fetchLLMHealth = async () => {
    setIsCheckingLLM(true);
    try {
      const health = await apiClient.checkLLMHealth();
      setLlmHealth(health);
    } catch (err: unknown) {
      setLlmHealth({
        status: 'error',
        api_key_configured: false,
        live_call_success: false,
        error: err instanceof Error ? err.message : 'Failed to ping LLM endpoint',
      });
    } finally {
      setIsCheckingLLM(false);
    }
  };

  useEffect(() => {
    fetchLLMHealth();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (llmDropdownRef.current && !llmDropdownRef.current.contains(e.target as Node)) {
        setShowLLMDropdown(false);
      }
    };
    if (showLLMDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLLMDropdown]);

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
                FS
              </div>
              <span className="font-semibold text-[16px] text-[#111318] tracking-tight">
                FinSort
              </span>
            </div>
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
                <span className="text-[10px] text-[#4A505C] font-sans font-semibold bg-white/80 px-1.5 py-0.5 rounded border border-black/[0.07]">
                  INR (₹)
                </span>
              </div>

              {/* Dynamic Live Cost Cutting Mini-Ticker in Sidebar */}
              <div className="mt-2.5 pt-2.5 border-t border-black/[0.06] space-y-1">
                <div className="flex items-center justify-between text-[10px] font-sans">
                  <span className="text-[#767D8C]">Current:</span>
                  <span className="font-semibold text-[#111318] tabular-nums">{formatINR(currentSpendInr)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-sans">
                  <span className="text-[#236B52] font-semibold">Cost Cut:</span>
                  <span className="font-semibold text-[#236B52] status-green px-1.5 py-0.2 rounded tabular-nums">
                    -{formatINR(acceptedSavingsInr)} ({acceptedSavingsPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-sans">
                  <span className="text-[#767D8C]">Run-Rate:</span>
                  <span className="font-semibold text-[#111318] tabular-nums">{formatINR(projectedSpendInr)}</span>
                </div>
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
              <span>Fleet Spend</span>
              <span
                className={`text-[10px] font-sans px-2 py-0.5 rounded-md font-semibold ${
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
                className={`text-[10px] font-sans px-2 py-0.5 rounded-md font-semibold ${
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
              <span>Actionable Recommendations</span>
              <span
                className={`text-[10px] font-sans px-2 py-0.5 rounded-md font-semibold ${
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
                className={`text-[10px] font-sans px-2 py-0.5 rounded-md font-medium ${
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
                className={`text-[10px] font-sans px-2 py-0.5 rounded-md font-medium ${
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
                className={`text-[10px] font-sans px-2 py-0.5 rounded-md font-medium ${
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
                className={`text-[10px] font-sans px-2 py-0.5 rounded-md font-medium ${
                  activeTab === 'assumptions' ? 'bg-white/15 text-white' : 'glass-pill-neutral'
                }`}
              >
                Formulas
              </span>
            </button>
          </nav>
        </div>
      </aside>

      {/* TOP STICKY GLASS CONTEXT BAR (ZERO-COLLISION RESPONSIVE FLEX LAYOUT) */}
      <header className="fixed top-0 left-64 right-0 h-16 bg-white/85 backdrop-blur-2xl border-b border-black/[0.07] z-40 px-4 sm:px-6 flex items-center justify-between gap-3 lg:gap-4 overflow-hidden shadow-[0_1px_8px_rgba(17,19,24,0.02)]">
        {/* Left: Screen Title & Regions (Constrained & Truncated) */}
        <div className="flex items-center gap-2 min-w-0 max-w-[180px] sm:max-w-[240px] md:max-w-[280px] lg:max-w-xs shrink">
          <h1
            className="text-[13px] sm:text-[14px] font-semibold text-[#111318] tracking-tight truncate"
            title={screenTitle}
          >
            {screenTitle}
          </h1>
          <span className="hidden 2xl:inline-flex px-2 py-0.5 rounded-md glass-pill-neutral text-[10px] font-sans font-medium shrink-0">
            Noida · BLR · BOM
          </span>
        </div>

        {/* Center: DYNAMIC TOTAL MONEY & COST CUTTING CLUSTER */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 shrink-0">
          {/* Spend */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-well border border-black/[0.06] text-xs font-sans shrink-0">
            <span className="text-[10px] text-[#767D8C] uppercase tracking-wider font-medium">Spend:</span>
            <span className="font-semibold text-[#111318] tabular-nums">{formatINR(currentSpendInr)}</span>
          </div>

          {/* Dynamic Cost Cutting Pill (Clean Minimal Indicator) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg status-green text-xs font-sans font-semibold shrink-0 shadow-xs tabular-nums">
            <span className="text-[10px] uppercase tracking-wider opacity-90">Cost Cut:</span>
            <span>↓ {formatINR(acceptedSavingsInr)}</span>
            <span className="opacity-80">(-{acceptedSavingsPct}%)</span>
          </div>

          {/* Projected Run-Rate */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-well border border-black/[0.06] text-xs font-sans shrink-0">
            <span className="text-[10px] text-[#767D8C] uppercase tracking-wider font-medium">Projected:</span>
            <span className="font-semibold text-[#111318] tabular-nums">{formatINR(projectedSpendInr)}</span>
          </div>

          {/* Unclaimed Pipeline */}
          {totalPotentialSavingsInr > acceptedSavingsInr && (
            <div className="hidden 2xl:flex items-center gap-1 px-2 py-1 rounded-lg status-yellow text-[11px] font-sans font-medium shrink-0 tabular-nums">
              <span>₹{Math.round((totalPotentialSavingsInr - acceptedSavingsInr) / 1000)}k Unclaimed</span>
            </div>
          )}
        </div>

        {/* Right: Actions & Copilot Popup Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Interactive LLM Telemetry Pill & Dropdown */}
          <div className="relative" ref={llmDropdownRef}>
            <button
              type="button"
              onClick={() => setShowLLMDropdown((prev) => !prev)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer border ${
                llmHealth?.live_call_success
                  ? 'bg-white hover:bg-black/[0.04] text-[#111318] border-black/[0.08]'
                  : 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]'
              }`}
              title="Gemini LLM Deployment Health & Telemetry"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCheckingLLM
                    ? 'bg-amber-400 animate-pulse'
                    : llmHealth?.live_call_success
                    ? 'bg-[#236B52]'
                    : 'bg-red-500'
                }`}
              />
              <span className="hidden sm:inline">
                {isCheckingLLM
                  ? 'Checking LLM...'
                  : llmHealth?.active_model
                  ? llmHealth.active_model
                  : 'Gemini LLM'}
              </span>
              <span className="sm:hidden">LLM</span>
            </button>

            {showLLMDropdown && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white/95 backdrop-blur-2xl border border-black/[0.1] shadow-xl p-3.5 z-50 text-xs font-sans space-y-2.5">
                <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
                  <div className="font-bold text-[#111318]">Gemini Telemetry</div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      llmHealth?.live_call_success
                        ? 'status-green'
                        : 'status-red'
                    }`}
                  >
                    {llmHealth?.live_call_success ? 'Online' : 'Degraded / Offline'}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#767D8C]">Active Model:</span>
                    <span className="font-semibold text-[#111318] font-mono">
                      {llmHealth?.active_model || 'None'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#767D8C]">API Key Status:</span>
                    <span className="font-medium text-[#111318]">
                      {llmHealth?.api_key_configured ? 'Configured (Live)' : 'Not Set'}
                    </span>
                  </div>
                  {llmHealth?.masked_key && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#767D8C]">Key Mask:</span>
                      <span className="font-mono text-[#4A505C]">{llmHealth.masked_key}</span>
                    </div>
                  )}
                  {typeof llmHealth?.latency_ms === 'number' && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#767D8C]">Latency:</span>
                      <span className="font-semibold text-[#236B52] tabular-nums">
                        {llmHealth.latency_ms.toFixed(0)} ms
                      </span>
                    </div>
                  )}
                  {llmHealth?.sample_response && (
                    <div className="pt-1 border-t border-black/[0.06] text-[10px] text-[#767D8C]">
                      Diagnostic Echo: <span className="font-mono text-[#111318]">{llmHealth.sample_response}</span>
                    </div>
                  )}
                  {llmHealth?.error && (
                    <div className="pt-1 text-[10px] text-red-600">
                      {llmHealth.error}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-black/[0.06] flex items-center justify-between">
                  <span className="text-[10px] text-[#767D8C]">Deployment Live Check</span>
                  <button
                    type="button"
                    onClick={() => fetchLLMHealth()}
                    disabled={isCheckingLLM}
                    className="px-2.5 py-1 rounded bg-[#111318] text-white text-[10px] font-semibold hover:bg-[#232730] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isCheckingLLM ? 'Pinging...' : 'Ping LLM'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Copilot Popup Toggle */}
          {onToggleChatbotPopup && (
            <button
              type="button"
              onClick={onToggleChatbotPopup}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer ${
                isChatbotPopupOpen
                  ? 'bg-[#111318] text-white shadow-xs'
                  : 'glass-well hover:bg-black/[0.08] text-[#111318] border border-black/[0.08]'
              }`}
            >
              <span>Copilot</span>
            </button>
          )}

          {pendingLowRiskCount > 0 && onBulkAcceptLowRisk && (
            <button
              type="button"
              onClick={onBulkAcceptLowRisk}
              className="hidden xl:inline-flex px-3 py-1.5 rounded-lg status-green hover:bg-[#236B52]/18 text-xs font-semibold transition-all cursor-pointer"
            >
              Approve Low-Risk ({pendingLowRiskCount})
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onExportReport) {
                onExportReport();
              } else if (onOpenExportModal) {
                onOpenExportModal();
              }
            }}
            className="hidden lg:inline-flex px-2.5 sm:px-3 py-1.5 rounded-lg glass-well hover:bg-black/[0.08] text-xs font-semibold text-[#111318] transition-all cursor-pointer border border-black/[0.08]"
          >
            Export CSV
          </button>

          {onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              className="px-3 py-1.5 rounded-lg bg-[#111318] hover:bg-[#232730] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Terraform &amp; CLI
            </button>
          )}
        </div>
      </header>
    </>
  );
};
