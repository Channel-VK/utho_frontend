import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/layout/Header';
import type { ActiveTab } from './components/layout/Header';
import { LiveCostBar } from './components/layout/LiveCostBar';
import { RemediationModal } from './components/common/RemediationModal';
import { DashboardView } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { ResourceDetailModal } from './views/ResourceDetailModal';
import { RecommendationsView } from './views/RecommendationsView';
import { SimulatorAndAlertsView } from './views/SimulatorAndAlertsView';
import { AssumptionsView } from './views/AssumptionsView';
import { apiClient } from './api/client';
import type {
  DashboardResponse,
  Resource,
  ResourceDetail,
  RecommendationsResponse,
  AnomalyAlert,
  AssumptionsResponse,
  RemediationExport,
  SimulationParams,
  SimulationResult,
} from './types/api';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isAIConnected, setIsAIConnected] = useState<boolean>(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  // Core Data States
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [recommendationsData, setRecommendationsData] = useState<RecommendationsResponse | null>(null);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [assumptions, setAssumptions] = useState<AssumptionsResponse | null>(null);

  // Inspector & Modal States
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedResourceDetail, setSelectedResourceDetail] = useState<ResourceDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<string>('ALL');
  const [recommendationsActionFilter, setRecommendationsActionFilter] = useState<string>('ALL');

  // Remediation Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportData, setExportData] = useState<RemediationExport | null>(null);
  const [isExportLoading, setIsExportLoading] = useState<boolean>(false);

  // Manual Check Backend Connection (:8080 & :8001)
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
      const [dash, recs] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getRecommendations(),
      ]);
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

        const [dash, resList, recs, alts, asm] = await Promise.all([
          apiClient.getDashboard(),
          apiClient.getResources(),
          apiClient.getRecommendations(),
          apiClient.getAlerts(),
          apiClient.getAssumptions(),
        ]);

        if (mounted) {
          setDashboardData(dash);
          setResources(resList);
          setRecommendationsData(recs);
          setAlerts(alts);
          setAssumptions(asm);
          if (typeof dash.ai_engine_connected === 'boolean') {
            setIsAIConnected(dash.ai_engine_connected);
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

  // Open resource drilldown
  const handleSelectResource = async (id: string) => {
    setSelectedResourceId(id);
    const detail = await apiClient.getResource(id);
    if (detail) {
      setSelectedResourceDetail(detail);
      setIsDetailModalOpen(true);
    }
  };

  // Close resource drilldown
  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedResourceId(null);
    setSelectedResourceDetail(null);
  };

  // Handle Accept Recommendation
  const handleAcceptRecommendation = async (id: string) => {
    await apiClient.patchRecommendation(id, 'accepted');
    await refreshDashboardAndRecs();

    if (selectedResourceId) {
      const updatedDetail = await apiClient.getResource(selectedResourceId);
      setSelectedResourceDetail(updatedDetail);
    }
  };

  // Handle Reject Recommendation
  const handleRejectRecommendation = async (id: string) => {
    await apiClient.patchRecommendation(id, 'rejected');
    await refreshDashboardAndRecs();

    if (selectedResourceId) {
      const updatedDetail = await apiClient.getResource(selectedResourceId);
      setSelectedResourceDetail(updatedDetail);
    }
  };

  // Bulk Accept Low-Risk
  const handleBulkAcceptLowRisk = async () => {
    await apiClient.bulkRecommendations('accepted', 'LOW_ONLY');
    await refreshDashboardAndRecs();

    if (selectedResourceId) {
      const updatedDetail = await apiClient.getResource(selectedResourceId);
      setSelectedResourceDetail(updatedDetail);
    }
  };

  // Accept Category from Monday Runbook Strip
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
      return r.action_type === 'RIGHTSIZE_VM';
    });

    await Promise.all(itemsToAccept.map((item) => apiClient.patchRecommendation(item.id, 'accepted')));
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

  // What-If Simulation runner
  const handleRunSimulation = useCallback(async (params: SimulationParams): Promise<SimulationResult> => {
    return apiClient.simulate(params);
  }, []);

  // Navigation shortcuts
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Layout Row 1: Main Navbar (h-14, single line, no clipping) */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'inventory') setInventoryStatusFilter('ALL');
          if (tab !== 'recommendations') setRecommendationsActionFilter('ALL');
          setActiveTab(tab);
        }}
        isConnected={isConnected}
        isAIConnected={isAIConnected}
        isChecking={isCheckingConnection}
        onCheckConnection={checkConnection}
        activeAlertsCount={alerts.length}
        pendingRecsCount={recommendationsData?.summary.pending_count || 0}
      />

      {/* Layout Row 2: Sticky Impact Bar (h-12, single line, justify-between) */}
      {dashboardData && recommendationsData && (
        <LiveCostBar
          currentMonthlyInr={dashboardData.current_monthly_spend_inr}
          projectedMonthlyInr={dashboardData.projected_monthly_spend_inr}
          acceptedSavingsInr={dashboardData.accepted_monthly_savings_inr}
          acceptedSavingsPct={dashboardData.accepted_savings_pct}
          acceptedCount={recommendationsData.summary.accepted_count}
          pendingLowRiskCount={pendingLowRiskCount}
          onBulkAcceptLowRisk={handleBulkAcceptLowRisk}
          onOpenExportModal={handleOpenExportModal}
        />
      )}

      {/* Main View Port Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && dashboardData && (
          <DashboardView
            data={dashboardData}
            recommendations={recommendationsData?.items || []}
            onNavigateToInventory={handleNavigateToInventoryWithFilter}
            onNavigateToRecommendations={handleNavigateToRecommendationsWithAction}
            onNavigateToAlerts={() => setActiveTab('simulator')}
            onAcceptCategory={handleAcceptCategory}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            resources={resources}
            selectedStatusFilter={inventoryStatusFilter}
            onSelectResource={handleSelectResource}
          />
        )}

        {activeTab === 'recommendations' && recommendationsData && (
          <RecommendationsView
            recommendations={recommendationsData.items}
            summary={recommendationsData.summary}
            initialFilterAction={recommendationsActionFilter}
            onAccept={handleAcceptRecommendation}
            onReject={handleRejectRecommendation}
            onBulkAcceptLowRisk={handleBulkAcceptLowRisk}
            onAcceptCategory={handleAcceptCategory}
            onOpenExportModal={handleOpenExportModal}
          />
        )}

        {activeTab === 'simulator' && (
          <SimulatorAndAlertsView
            alerts={alerts}
            onSimulate={handleRunSimulation}
            onInspectResource={handleSelectResource}
          />
        )}

        {activeTab === 'assumptions' && assumptions && (
          <AssumptionsView assumptions={assumptions} />
        )}
      </main>

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

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-center text-xs text-zinc-500 font-mono">
        SmartCloud Optimizer • FinOps Engineering Platform for Utho Cloud • Latency SLA Safe Rightsizing Engine
      </footer>
    </div>
  );
}

export default App;
