import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/layout/Header';
import type { ActiveTab } from './components/layout/Header';
import { RemediationModal } from './components/common/RemediationModal';
import { DashboardView } from './views/DashboardView';
import type { ResourceCategoryTab } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { ResourceDetailModal } from './views/ResourceDetailModal';
import { RecommendationsView } from './views/RecommendationsView';
import { SimulatorAndAlertsView } from './views/SimulatorAndAlertsView';
import { AssumptionsView } from './views/AssumptionsView';
import { CopilotView } from './views/CopilotView';
import { ChatbotPopup } from './components/common/ChatbotPopup';
import { apiClient } from './api/client';
import type {
  DashboardResponse,
  Resource,
  ResourceDetail,
  Recommendation,
  RecommendationsSummary,
  RecommendationsResponse,
  AnomalyAlert,
  AssumptionsResponse,
  RemediationExport,
  SimulationParams,
  SimulationResult,
} from './types/api';

const DECISIONS_STORAGE_KEY = 'finsort_recommendation_decisions';

function loadStoredDecisions(): Record<string, 'accepted' | 'rejected' | 'pending'> {
  try {
    const raw = localStorage.getItem(DECISIONS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveStoredDecisions(decisions: Record<string, 'accepted' | 'rejected' | 'pending'>) {
  try {
    localStorage.setItem(DECISIONS_STORAGE_KEY, JSON.stringify(decisions));
  } catch (err) {
    console.error('Failed to save recommendation decisions to localStorage:', err);
  }
}

function recomputeSummaryFromItems(items: Recommendation[], currentSpend: number): RecommendationsSummary {
  let acceptedSavings = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  for (const item of items) {
    if (item.status === 'accepted') {
      acceptedCount++;
      acceptedSavings += item.monthly_savings_inr;
    } else if (item.status === 'rejected') {
      rejectedCount++;
    } else {
      pendingCount++;
    }
  }

  const projectedSpend = Math.max(0, currentSpend - acceptedSavings);
  const acceptedSavingsPct = currentSpend > 0 ? Number(((acceptedSavings / currentSpend) * 100).toFixed(1)) : 0;

  return {
    current_monthly_inr: currentSpend,
    projected_monthly_inr: projectedSpend,
    accepted_savings_inr: acceptedSavings,
    accepted_savings_pct: acceptedSavingsPct,
    accepted_count: acceptedCount,
    rejected_count: rejectedCount,
    pending_count: pendingCount,
  };
}

function applyStoredDecisions(
  recs: RecommendationsResponse,
  currentSpend: number
): { recs: RecommendationsResponse; modified: boolean } {
  const decisions = loadStoredDecisions();
  if (Object.keys(decisions).length === 0 || !recs?.items) {
    return { recs, modified: false };
  }

  let modified = false;
  let acceptedSavings = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  const items = recs.items.map((item) => {
    const decision = decisions[item.id];
    const status = decision || item.status || 'pending';
    if (decision && decision !== item.status) {
      modified = true;
    }
    if (status === 'accepted') {
      acceptedCount++;
      acceptedSavings += item.monthly_savings_inr;
    } else if (status === 'rejected') {
      rejectedCount++;
    } else {
      pendingCount++;
    }
    return { ...item, status: status as 'accepted' | 'rejected' | 'pending' };
  });

  const projectedSpend = Math.max(0, currentSpend - acceptedSavings);
  const acceptedSavingsPct = currentSpend > 0 ? Number(((acceptedSavings / currentSpend) * 100).toFixed(1)) : 0;

  return {
    recs: {
      summary: {
        current_monthly_inr: currentSpend,
        projected_monthly_inr: projectedSpend,
        accepted_savings_inr: acceptedSavings,
        accepted_savings_pct: acceptedSavingsPct,
        accepted_count: acceptedCount,
        rejected_count: rejectedCount,
        pending_count: pendingCount,
        by_env: recs.summary?.by_env,
        by_action: recs.summary?.by_action,
      },
      items,
    },
    modified,
  };
}

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [resourceCategory, setResourceCategory] = useState<ResourceCategoryTab>('ALL');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isAIConnected, setIsAIConnected] = useState<boolean>(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  // Core Data States
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [recommendationsData, setRecommendationsData] = useState<RecommendationsResponse | null>(null);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [assumptions, setAssumptions] = useState<AssumptionsResponse | null>(null);

  // Inspector Drawer & Modal States
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedResourceDetail, setSelectedResourceDetail] = useState<ResourceDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<string>('ALL');
  const [recommendationsActionFilter, setRecommendationsActionFilter] = useState<string>('ALL');

  // Remediation Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportData, setExportData] = useState<RemediationExport | null>(null);
  const [isExportLoading, setIsExportLoading] = useState<boolean>(false);

  // AI Chatbot Floating Popup State
  const [isChatbotPopupOpen, setIsChatbotPopupOpen] = useState<boolean>(false);

  const checkConnection = useCallback(async () => {
    setIsCheckingConnection(true);
    try {
      const status = await apiClient.checkServiceStatus();
      setIsConnected(status.goConnected);
      setIsAIConnected(status.aiConnected);
    } finally {
      setIsCheckingConnection(false);
    }
  }, []);

  const refreshDashboardAndRecs = async () => {
    try {
      const [dash, rawRecs] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getRecommendations(),
      ]);
      const baselineSpend = dash?.current_monthly_spend_inr || 683200;
      const { recs, modified } = applyStoredDecisions(rawRecs, baselineSpend);
      if (modified) {
        dash.accepted_monthly_savings_inr = recs.summary.accepted_savings_inr;
        dash.projected_monthly_spend_inr = recs.summary.projected_monthly_inr;
        dash.accepted_savings_pct = recs.summary.accepted_savings_pct;
      }
      setDashboardData(dash);
      setRecommendationsData(recs);
      if (typeof dash.ai_engine_connected === 'boolean') {
        setIsAIConnected(dash.ai_engine_connected);
      }
    } catch (err) {
      console.error('Failed to refresh dashboard and recs:', err);
    }
  };

  useEffect(() => {
    let mounted = true;
    const initializePlatform = async () => {
      try {
        const status = await apiClient.checkServiceStatus();
        if (mounted) {
          setIsConnected(status.goConnected);
          setIsAIConnected(status.aiConnected);
        }

        const [dash, resList, rawRecs, alts, asm] = await Promise.all([
          apiClient.getDashboard(),
          apiClient.getResources(),
          apiClient.getRecommendations(),
          apiClient.getAlerts(),
          apiClient.getAssumptions(),
        ]);

        const baselineSpend = dash?.current_monthly_spend_inr || 683200;
        const { recs, modified } = applyStoredDecisions(rawRecs, baselineSpend);

        if (modified) {
          dash.accepted_monthly_savings_inr = recs.summary.accepted_savings_inr;
          dash.projected_monthly_spend_inr = recs.summary.projected_monthly_inr;
          dash.accepted_savings_pct = recs.summary.accepted_savings_pct;

          // Synchronize saved decisions with backend in background
          const decisions = loadStoredDecisions();
          for (const [id, decision] of Object.entries(decisions)) {
            apiClient.patchRecommendation(id, decision).catch(() => {});
          }
        }

        if (mounted) {
          setDashboardData(dash);
          setResources(resList);
          setRecommendationsData(recs);
          setAlerts(alts);
          setAssumptions(asm);
          if (typeof dash.ai_engine_connected === 'boolean') {
            setIsAIConnected(dash.ai_engine_connected);
          }

          // Pre-populate the right-hand Resource Inspection Drawer on Screen 1
          const firstFlagged =
            resList.find((r) => r.optimization_status === 'OVERPROVISIONED') || resList[0];
          if (firstFlagged) {
            setSelectedResourceId(firstFlagged.id);
            apiClient.getResource(firstFlagged.id).then((detail) => {
              if (mounted && detail) {
                setSelectedResourceDetail(detail);
              }
            });
          }
        }
      } catch (err) {
        console.error('Failed to initialize FinOps data:', err);
      }
    };

    initializePlatform();
    return () => {
      mounted = false;
    };
  }, []);

  // Select resource for either inline drawer or full 30-day modal
  const handleSelectResource = async (id: string, openFullModal = true) => {
    setSelectedResourceId(id);
    if (openFullModal) {
      setIsDetailModalOpen(true);
    }
    const detail = await apiClient.getResource(id);
    if (detail) {
      setSelectedResourceDetail(detail);
    }
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
  };

  // Handle Accept Recommendation
  const handleAcceptRecommendation = async (id: string) => {
    // 1. Immediately persist decision to localStorage
    const stored = loadStoredDecisions();
    stored[id] = 'accepted';
    saveStoredDecisions(stored);

    // 2. Immediately update UI state optimistically
    const currentSpendVal = dashboardData?.current_monthly_spend_inr || 683200;
    setRecommendationsData((prev) => {
      if (!prev) return prev;
      const updatedItems = prev.items.map((it) =>
        it.id === id ? { ...it, status: 'accepted' as const } : it
      );
      const summary = recomputeSummaryFromItems(updatedItems, currentSpendVal);
      return { summary, items: updatedItems };
    });

    // 3. Send update to backend and refresh
    await apiClient.patchRecommendation(id, 'accepted');
    await refreshDashboardAndRecs();

    if (selectedResourceId) {
      const updatedDetail = await apiClient.getResource(selectedResourceId);
      if (updatedDetail) setSelectedResourceDetail(updatedDetail);
    }
  };

  // Handle Reject Recommendation
  const handleRejectRecommendation = async (id: string) => {
    // 1. Immediately persist decision to localStorage
    const stored = loadStoredDecisions();
    stored[id] = 'rejected';
    saveStoredDecisions(stored);

    // 2. Immediately update UI state optimistically
    const currentSpendVal = dashboardData?.current_monthly_spend_inr || 683200;
    setRecommendationsData((prev) => {
      if (!prev) return prev;
      const updatedItems = prev.items.map((it) =>
        it.id === id ? { ...it, status: 'rejected' as const } : it
      );
      const summary = recomputeSummaryFromItems(updatedItems, currentSpendVal);
      return { summary, items: updatedItems };
    });

    // 3. Send update to backend and refresh
    await apiClient.patchRecommendation(id, 'rejected');
    await refreshDashboardAndRecs();

    if (selectedResourceId) {
      const updatedDetail = await apiClient.getResource(selectedResourceId);
      if (updatedDetail) setSelectedResourceDetail(updatedDetail);
    }
  };

  // Bulk Accept Low-Risk
  const handleBulkAcceptLowRisk = async () => {
    // 1. Immediately persist decision to localStorage for all LOW risk items
    const stored = loadStoredDecisions();
    const lowRiskItems = recommendationsData?.items.filter((r) => r.risk_level === 'LOW') || [];
    for (const item of lowRiskItems) {
      stored[item.id] = 'accepted';
    }
    saveStoredDecisions(stored);

    // 2. Immediately update UI state optimistically
    const currentSpendVal = dashboardData?.current_monthly_spend_inr || 683200;
    setRecommendationsData((prev) => {
      if (!prev) return prev;
      const updatedItems = prev.items.map((it) =>
        it.risk_level === 'LOW' ? { ...it, status: 'accepted' as const } : it
      );
      const summary = recomputeSummaryFromItems(updatedItems, currentSpendVal);
      return { summary, items: updatedItems };
    });

    // 3. Send update to backend and refresh
    await apiClient.bulkRecommendations('accepted', 'LOW_ONLY');
    await refreshDashboardAndRecs();

    if (selectedResourceId) {
      const updatedDetail = await apiClient.getResource(selectedResourceId);
      if (updatedDetail) setSelectedResourceDetail(updatedDetail);
    }
  };

  // Accept Category from Priority Optimization Cards
  const handleAcceptCategory = async (category: 'orphan' | 'off_hours' | 'rightsize') => {
    if (!recommendationsData?.items) return;

    const itemsToAccept = recommendationsData.items.filter((r) => {
      if (r.status !== 'pending') return false;
      if (category === 'orphan') {
        return (
          r.action_type === 'CLEANUP_ORPHAN' ||
          r.action_type === 'CLEAN_ORPHANED_VOLUME' ||
          r.action_type === 'CLEAN_ORPHANED_IP'
        );
      }
      if (category === 'off_hours') {
        return (
          r.action_type === 'SCHEDULE_OFF_HOURS' ||
          r.action_type === 'OFF_HOURS_SHUTDOWN'
        );
      }
      return (
        r.action_type === 'RIGHTSIZE_VM' ||
        r.action_type === 'TERMINATE_ZOMBIE' ||
        r.action_type === 'TERMINATE_ZOMBIE_VM'
      );
    });

    // 1. Immediately persist decision to localStorage
    const stored = loadStoredDecisions();
    for (const item of itemsToAccept) {
      stored[item.id] = 'accepted';
    }
    saveStoredDecisions(stored);

    // 2. Immediately update UI state optimistically
    const currentSpendVal = dashboardData?.current_monthly_spend_inr || 683200;
    setRecommendationsData((prev) => {
      if (!prev) return prev;
      const acceptedIds = new Set(itemsToAccept.map((i) => i.id));
      const updatedItems = prev.items.map((it) =>
        acceptedIds.has(it.id) ? { ...it, status: 'accepted' as const } : it
      );
      const summary = recomputeSummaryFromItems(updatedItems, currentSpendVal);
      return { summary, items: updatedItems };
    });

    // 3. Send updates to backend and refresh
    await Promise.all(
      itemsToAccept.map((item) => apiClient.patchRecommendation(item.id, 'accepted'))
    );
    await refreshDashboardAndRecs();
  };

  // Open Export Modal
  const handleOpenExportModal = async () => {
    setIsExportModalOpen(true);
    setIsExportLoading(true);
    try {
      const data = await apiClient.getRemediationExport();
      setExportData(data);
    } finally {
      setIsExportLoading(false);
    }
  };

  // Direct CSV Audit Report Download (Requirement 17)
  const handleExportCsvReport = () => {
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
    const recByResourceId = new Map((recommendationsData?.items || []).map((r) => [r.resource_id, r]));
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

  // What-If Simulation runner
  const handleRunSimulation = useCallback(
    async (params: SimulationParams): Promise<SimulationResult> => {
      return apiClient.simulate(params);
    },
    []
  );

  const handleNavigateToInventoryWithFilter = (status?: string) => {
    setInventoryStatusFilter(status || 'ALL');
    setActiveTab('inventory');
  };

  const handleNavigateToRecommendationsWithAction = (action?: string) => {
    setRecommendationsActionFilter(action || 'ALL');
    setActiveTab('recommendations');
  };

  const pendingLowRiskCount =
    recommendationsData?.items.filter(
      (r) => r.status === 'pending' && r.risk_level === 'LOW'
    ).length || 0;

  // Dynamic Financial Metrics (Consistent and live across all tabs)
  const currentSpend = dashboardData?.current_monthly_spend_inr || 683200;
  const acceptedSavings =
    recommendationsData?.summary?.accepted_savings_inr ??
    dashboardData?.accepted_monthly_savings_inr ??
    0;
  const projectedSpend =
    recommendationsData?.summary?.projected_monthly_inr ??
    dashboardData?.projected_monthly_spend_inr ??
    (currentSpend - acceptedSavings);
  const acceptedSavingsPct =
    recommendationsData?.summary?.accepted_savings_pct ??
    dashboardData?.accepted_savings_pct ??
    (currentSpend > 0 ? Math.round((acceptedSavings / currentSpend) * 1000) / 10 : 0.0);
  const totalPotentialSavings =
    dashboardData?.total_potential_savings_inr ||
    recommendationsData?.items?.reduce((acc, r) => acc + r.monthly_savings_inr, 0) ||
    277230;

  return (
    <div className="min-h-screen text-[#111318] flex font-sans">
      {/* Left Persistent Sidebar + Top Sticky Context Bar with Dynamic Total Money */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'inventory') setInventoryStatusFilter('ALL');
          if (tab !== 'recommendations') setRecommendationsActionFilter('ALL');
          setActiveTab(tab);
        }}
        onQuickCategorySelect={(cat) => setResourceCategory(cat)}
        activeResourceCategory={resourceCategory}
        isConnected={isConnected}
        isAIConnected={isAIConnected}
        isChecking={isCheckingConnection}
        onCheckConnection={checkConnection}
        activeAlertsCount={alerts.length}
        pendingRecsCount={recommendationsData?.summary.pending_count || 0}
        pendingLowRiskCount={pendingLowRiskCount}
        onBulkAcceptLowRisk={handleBulkAcceptLowRisk}
        onOpenExportModal={handleOpenExportModal}
        onExportReport={handleExportCsvReport}
        currentSpendInr={currentSpend}
        acceptedSavingsInr={acceptedSavings}
        projectedSpendInr={projectedSpend}
        acceptedSavingsPct={acceptedSavingsPct}
        totalPotentialSavingsInr={totalPotentialSavings}
        onToggleChatbotPopup={() => setIsChatbotPopupOpen((prev) => !prev)}
        isChatbotPopupOpen={isChatbotPopupOpen}
      />

      {/* Main Content Shell (pl-64 for sidebar, pt-20 for sticky h-16 top bar) */}
      <div className="pl-64 flex-1 flex flex-col min-w-0">
        <main className="relative flex-1 w-full pt-20 px-6 max-w-[1600px] mx-auto">
          {activeTab === 'dashboard' && dashboardData && (
            <DashboardView
              data={dashboardData}
              resources={resources}
              recommendations={recommendationsData?.items || []}
              selectedResourceDetail={selectedResourceDetail}
              externalCategory={resourceCategory}
              onCategoryChange={setResourceCategory}
              onSelectResourceForDrawer={(id, openModal) =>
                handleSelectResource(id, Boolean(openModal))
              }
              onAcceptRecommendation={handleAcceptRecommendation}
              onNavigateToInventory={handleNavigateToInventoryWithFilter}
              onNavigateToRecommendations={handleNavigateToRecommendationsWithAction}
              onNavigateToAlerts={() => setActiveTab('simulator')}
              onAcceptCategory={handleAcceptCategory}
              onOpenExportModal={handleOpenExportModal}
            />
          )}

          {activeTab === 'simulator' && (
            <SimulatorAndAlertsView
              alerts={alerts}
              baselineMonthlyInr={dashboardData?.current_monthly_spend_inr}
              onSimulate={handleRunSimulation}
              onInspectResource={(id) => handleSelectResource(id, true)}
              onOpenExportModal={handleOpenExportModal}
            />
          )}

          {activeTab === 'recommendations' && recommendationsData && (
            <RecommendationsView
              recommendations={recommendationsData.items}
              summary={recommendationsData.summary}
              dashboardData={dashboardData}
              assumptions={assumptions}
              resources={resources}
              initialFilterAction={recommendationsActionFilter}
              onAccept={handleAcceptRecommendation}
              onReject={handleRejectRecommendation}
              onBulkAcceptLowRisk={handleBulkAcceptLowRisk}
              onAcceptCategory={handleAcceptCategory}
              onOpenExportModal={handleOpenExportModal}
              onSelectResource={(id) => handleSelectResource(id, true)}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              resources={resources}
              selectedStatusFilter={inventoryStatusFilter}
              onSelectResource={(id) => handleSelectResource(id, true)}
            />
          )}

          {activeTab === 'assumptions' && assumptions && (
            <AssumptionsView assumptions={assumptions} />
          )}

          {activeTab === 'copilot' && (
            <CopilotView
              isAIConnected={isAIConnected}
              onInspectResource={(id) => handleSelectResource(id, true)}
              onNavigateToTab={(tab) => setActiveTab(tab as ActiveTab)}
            />
          )}
        </main>
      </div>

      {/* 30-Day Resource Detail Inspector Modal */}
      <ResourceDetailModal
        resource={selectedResourceDetail}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        onAcceptRecommendation={handleAcceptRecommendation}
        onRejectRecommendation={handleRejectRecommendation}
      />

      {/* Export Remediation Manifests Modal */}
      <RemediationModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        exportData={exportData}
        isLoading={isExportLoading}
      />

      {/* Floating Action Pill for Quick FinSort Copilot Popup */}
      {!isChatbotPopupOpen && (
        <button
          type="button"
          onClick={() => setIsChatbotPopupOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-[#111318] hover:bg-[#232730] text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-semibold font-sans border border-white/10 backdrop-blur-xl transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-black/20"
        >
          <span>FinSort Copilot</span>
        </button>
      )}

      {/* Floating AI Chatbot Popup Modal/Window */}
      <ChatbotPopup
        isOpen={isChatbotPopupOpen}
        onClose={() => setIsChatbotPopupOpen(false)}
        isAIConnected={isAIConnected}
        currentSpendInr={currentSpend}
        acceptedSavingsInr={acceptedSavings}
      />
    </div>
  );
}

export default App;
