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
    await apiClient.patchRecommendation(id, 'accepted');
    await refreshDashboardAndRecs();

    if (selectedResourceId) {
      const updatedDetail = await apiClient.getResource(selectedResourceId);
      if (updatedDetail) setSelectedResourceDetail(updatedDetail);
    }
  };

  // Handle Reject Recommendation
  const handleRejectRecommendation = async (id: string) => {
    await apiClient.patchRecommendation(id, 'rejected');
    await refreshDashboardAndRecs();

    if (selectedResourceId) {
      const updatedDetail = await apiClient.getResource(selectedResourceId);
      if (updatedDetail) setSelectedResourceDetail(updatedDetail);
    }
  };

  // Bulk Accept Low-Risk
  const handleBulkAcceptLowRisk = async () => {
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

  return (
    <div className="min-h-screen text-[#111318] flex font-sans">
      {/* Left Persistent Sidebar + Top Sticky Context Bar (Stitch FinSort 1:1) */}
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
      />

      {/* Main Content Shell (pl-64 for sidebar, pt-14 for sticky top bar) */}
      <div className="pl-64 flex-1 flex flex-col min-w-0">
        <main className="relative flex-1 w-full pt-18 px-6 max-w-[1600px] mx-auto">
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
    </div>
  );
}

export default App;
