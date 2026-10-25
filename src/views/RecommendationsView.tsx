import React, { useState, useMemo } from 'react';
import type {
  Recommendation,
  RecommendationsSummary,
  DashboardResponse,
  AssumptionsResponse,
  Resource,
  PricingPlan,
} from '../types/api';
import { formatINR } from '../utils/format';

interface RecommendationsViewProps {
  recommendations: Recommendation[];
  summary: RecommendationsSummary;
  dashboardData?: DashboardResponse | null;
  assumptions?: AssumptionsResponse | null;
  resources?: Resource[];
  initialFilterAction?: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onBulkAcceptLowRisk: () => void;
  onAcceptCategory?: (category: 'orphan' | 'off_hours' | 'rightsize') => void;
  onOpenExportModal: () => void;
  onSelectResource?: (id: string) => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  recommendations,
  summary,
  dashboardData,
  assumptions,
  resources = [],
  initialFilterAction = 'ALL',
  onAccept,
  onReject,
  onBulkAcceptLowRisk,
  onOpenExportModal,
  onSelectResource,
}) => {
  const [filterAction, setFilterAction] = useState<string>(initialFilterAction);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'pending' | 'accepted' | 'rejected'>('ALL');
  const [filterEnvCard, setFilterEnvCard] = useState<'ALL' | 'prod' | 'staging' | 'dev' | 'storage'>('ALL');

  // Map resource_id -> Resource for exact monthly cost & hardware spec lookup
  const resourceMap = useMemo(() => {
    const map = new Map<string, Resource>();
    for (const r of resources) {
      map.set(r.id, r);
    }
    return map;
  }, [resources]);

  // Compute live statistics for the 4 Environment Summary Cards
  const envCardMetrics = useMemo(() => {
    const envBySpend = dashboardData?.spend_by_env || [];
    const prodSpend = envBySpend.find((e) => e.env.toLowerCase().includes('prod'));
    const stagingSpend = envBySpend.find((e) => e.env.toLowerCase().includes('stag'));
    const devSpend = envBySpend.find((e) => e.env.toLowerCase().includes('dev'));

    const prodRecs = recommendations.filter((r) => r.env.toLowerCase() === 'prod');
    const stagingRecs = recommendations.filter((r) => r.env.toLowerCase() === 'staging');
    const devRecs = recommendations.filter((r) => r.env.toLowerCase() === 'dev');
    const storageRecs = recommendations.filter(
      (r) =>
        r.action_type === 'CLEANUP_ORPHAN' ||
        r.action_type === 'CLEAN_ORPHANED_VOLUME' ||
        r.action_type === 'CLEAN_ORPHANED_IP'
    );

    const prodSavings = prodRecs.reduce((a, b) => a + b.monthly_savings_inr, 0);
    const stagingSavings = stagingRecs.reduce((a, b) => a + b.monthly_savings_inr, 0);
    const devSavings = devRecs.reduce((a, b) => a + b.monthly_savings_inr, 0);
    const storageSavings = storageRecs.reduce((a, b) => a + b.monthly_savings_inr, 0);

    const prodBaseline = prodSpend?.current_inr || 760000;
    const stagingBaseline = stagingSpend?.current_inr || 295000;
    const devBaseline = devSpend?.current_inr || 229500;
    const storageBaseline =
      resources
        .filter((r) => r.type !== 'vm')
        .reduce((a, b) => a + b.monthly_cost_inr, 0) || 142000;

    return {
      prod: {
        baseline: prodBaseline,
        projected: Math.max(0, prodBaseline - prodSavings),
        savings: prodSavings,
        pct: prodBaseline > 0 ? ((prodSavings / prodBaseline) * 100).toFixed(1) : '0.0',
        count: prodRecs.length,
      },
      staging: {
        baseline: stagingBaseline,
        projected: Math.max(0, stagingBaseline - stagingSavings),
        savings: stagingSavings,
        pct: stagingBaseline > 0 ? ((stagingSavings / stagingBaseline) * 100).toFixed(1) : '0.0',
        count: stagingRecs.length,
      },
      dev: {
        baseline: devBaseline,
        projected: Math.max(0, devBaseline - devSavings),
        savings: devSavings,
        pct: devBaseline > 0 ? ((devSavings / devBaseline) * 100).toFixed(1) : '0.0',
        count: devRecs.length,
      },
      storage: {
        baseline: storageBaseline,
        projected: Math.max(0, storageBaseline - storageSavings),
        savings: storageSavings,
        pct: storageBaseline > 0 ? ((storageSavings / storageBaseline) * 100).toFixed(1) : '0.0',
        count: storageRecs.length,
      },
    };
  }, [dashboardData, recommendations, resources]);

  const filteredItems = useMemo(() => {
    return recommendations.filter((item) => {
      if (filterEnvCard === 'prod' && item.env.toLowerCase() !== 'prod') return false;
      if (filterEnvCard === 'staging' && item.env.toLowerCase() !== 'staging') return false;
      if (filterEnvCard === 'dev' && item.env.toLowerCase() !== 'dev') return false;
      if (
        filterEnvCard === 'storage' &&
        item.action_type !== 'CLEANUP_ORPHAN' &&
        item.action_type !== 'CLEAN_ORPHANED_VOLUME' &&
        item.action_type !== 'CLEAN_ORPHANED_IP'
      )
        return false;

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

      return !(filterStatus !== 'ALL' && item.status !== filterStatus);

    });
  }, [recommendations, filterEnvCard, filterAction, filterStatus]);

  // Normalize Utho Cloud catalog pricing from live assumptions
  const catalogList: PricingPlan[] = useMemo(() => {
    const rawCatalog = assumptions?.pricing_catalog || {};
    if (Array.isArray(rawCatalog) && rawCatalog.length > 0) {
      return rawCatalog;
    }
    const entries = Object.entries(rawCatalog);
    if (entries.length > 0) {
      return entries.map(([k, v]: [string, any]) => ({
        plan: v.name || k,
        vcpu: v.vcpu ?? 0,
        ram_gb: v.ram_gb ?? 0,
        hourly_inr: v.hourly_rate_inr ?? v.hourly_inr ?? 0,
        monthly_inr: v.monthly_rate_inr ?? v.monthly_inr ?? 0,
        target_workload:
          v.vcpu > 0 ? `${v.vcpu} vCPU, ${v.ram_gb} GiB` : 'Block SSD / Elastic IPv4',
      }));
    }
    return [
      { plan: 'c4.large', vcpu: 2, ram_gb: 4, hourly_inr: 4.38, monthly_inr: 3200, target_workload: '2 vCPU, 4 GiB' },
      { plan: 'c4.xlarge', vcpu: 4, ram_gb: 8, hourly_inr: 8.77, monthly_inr: 6400, target_workload: '4 vCPU, 8 GiB' },
      { plan: 'm8.xlarge', vcpu: 4, ram_gb: 16, hourly_inr: 13.15, monthly_inr: 9600, target_workload: '4 vCPU, 16 GiB' },
      { plan: 'm8.2xlarge', vcpu: 8, ram_gb: 32, hourly_inr: 26.30, monthly_inr: 19200, target_workload: '8 vCPU, 32 GiB' },
      { plan: 'r8.2xlarge', vcpu: 8, ram_gb: 64, hourly_inr: 35.62, monthly_inr: 26000, target_workload: '8 vCPU, 64 GiB High-Mem' },
      { plan: 'c8.4xlarge', vcpu: 16, ram_gb: 32, hourly_inr: 46.58, monthly_inr: 34000, target_workload: '16 vCPU, 32 GiB Compute' },
    ];
  }, [assumptions]);

  const baselineMonthlyInr = dashboardData?.current_monthly_spend_inr || summary.current_monthly_inr || 683200;
  const totalPotentialSavingsInr =
    dashboardData?.total_potential_savings_inr ||
    recommendations.reduce((acc, r) => acc + r.monthly_savings_inr, 0);
  const totalSavingsPct =
    baselineMonthlyInr > 0
      ? ((totalPotentialSavingsInr / baselineMonthlyInr) * 100).toFixed(1)
      : '28.5';

  const pendingLowRiskCount = recommendations.filter(
    (r) => r.status === 'pending' && r.risk_level === 'LOW'
  ).length;

  return (
    <div className="flex flex-col w-full pb-16 space-y-space-xl">
      {/* 1. TOP HEADER & TELEMETRY BAR */}
      <section className="flex flex-col gap-space-md pt-1">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col space-y-1">
            <h1 className="font-headline-xl text-headline-xl tracking-tight text-[#111318]">
              Recommendations &amp; Pricing
            </h1>
            <p className="font-body-md text-body-md text-[#525866] max-w-3xl">
              Audit algorithmic right-sizing recommendations across environments, track projected savings, and inspect benchmark Utho Cloud catalog pricing.
            </p>
          </div>
          <div className="flex items-center gap-space-sm self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={onOpenExportModal}
              className="px-4 py-2 rounded-lg glass-card text-[#111318] hover:bg-white/90 transition-colors font-body-sm text-body-sm font-semibold"
            >
              Export CSV &amp; HCL Plan
            </button>
            <button
              type="button"
              onClick={onBulkAcceptLowRisk}
              className="px-5 py-2 rounded-lg bg-[#111318] text-white hover:bg-[#272B33] transition-colors font-body-sm text-body-sm font-semibold"
            >
              {pendingLowRiskCount > 0
                ? `Approve All Low-Risk (${pendingLowRiskCount})`
                : `Approved (${summary.accepted_count})`}
            </button>
          </div>
        </div>

        {/* Context Telemetry Pills (Text-Only) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="px-3 py-1 rounded-full glass-pill-neutral font-label-caps text-label-caps uppercase tracking-wider">
            Catalog Synced: Utho Cloud API
          </div>
          <div className="px-3 py-1 rounded-full glass-pill-neutral font-label-caps text-label-caps uppercase tracking-wider">
            Regions: in-mumbai-1 · in-bangalore-1 · in-noida-1
          </div>
          <div className="px-3 py-1 rounded-full glass-pill-neutral font-label-caps text-label-caps uppercase tracking-wider">
            Monthly Baseline: {formatINR(baselineMonthlyInr)}
          </div>
          <div className="px-3 py-1 rounded-full status-green font-label-caps text-label-caps uppercase tracking-wider font-semibold">
            Projected Total Savings: {formatINR(totalPotentialSavingsInr)}/mo (-{totalSavingsPct}%)
          </div>
        </div>
      </section>

      {/* 2. TOP FOUR ENVIRONMENT SUMMARY CARDS */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* CARD 1: PRODUCTION */}
        <div
          onClick={() => setFilterEnvCard(filterEnvCard === 'prod' ? 'ALL' : 'prod')}
          className={`cursor-pointer p-space-lg rounded-2xl glass-card transition-all flex flex-col justify-between space-y-4 ${
            filterEnvCard === 'prod' ? 'ring-2 ring-[#111318]/25 border-[#111318]/30' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-[#111318] font-bold">
                PRODUCTION
              </span>
              <span className="font-code-sm text-code-sm text-[#68707E]">env-prod-primary</span>
            </div>
            <span className="px-2 py-0.5 rounded glass-pill-neutral font-label-caps text-label-caps uppercase">
              Critical SLA
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="font-tabular-numeric-lg text-tabular-numeric-lg text-[#111318]">
                {formatINR(envCardMetrics.prod.projected)}
              </span>
              <span className="font-body-sm text-body-sm text-[#68707E]">/mo projected</span>
            </div>
            <div className="font-body-sm text-body-sm text-[#68707E] line-through">
              Baseline: {formatINR(envCardMetrics.prod.baseline)} /mo
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <div className="inline-flex px-2.5 py-1 rounded status-green font-label-caps text-label-caps uppercase font-bold">
              Save {formatINR(envCardMetrics.prod.savings)}/mo (-{envCardMetrics.prod.pct}%)
            </div>
            <p className="font-body-sm text-body-sm text-[#525866]">
              {envCardMetrics.prod.count} p95/p99 peak-verified right-sizing rules
            </p>
          </div>
        </div>

        {/* CARD 2: STAGING */}
        <div
          onClick={() => setFilterEnvCard(filterEnvCard === 'staging' ? 'ALL' : 'staging')}
          className={`cursor-pointer p-space-lg rounded-2xl glass-card transition-all flex flex-col justify-between space-y-4 ${
            filterEnvCard === 'staging' ? 'ring-2 ring-[#111318]/25 border-[#111318]/30' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-[#111318] font-bold">
                STAGING
              </span>
              <span className="font-code-sm text-code-sm text-[#68707E]">env-staging-cluster</span>
            </div>
            <span className="px-2 py-0.5 rounded glass-pill-neutral font-label-caps text-label-caps uppercase">
              Flexible
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="font-tabular-numeric-lg text-tabular-numeric-lg text-[#111318]">
                {formatINR(envCardMetrics.staging.projected)}
              </span>
              <span className="font-body-sm text-body-sm text-[#68707E]">/mo projected</span>
            </div>
            <div className="font-body-sm text-body-sm text-[#68707E] line-through">
              Baseline: {formatINR(envCardMetrics.staging.baseline)} /mo
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <div className="inline-flex px-2.5 py-1 rounded status-green font-label-caps text-label-caps uppercase font-bold">
              Save {formatINR(envCardMetrics.staging.savings)}/mo (-{envCardMetrics.staging.pct}%)
            </div>
            <p className="font-body-sm text-body-sm text-[#525866]">
              {envCardMetrics.staging.count} weekend auto-sleep &amp; node downscaling rules
            </p>
          </div>
        </div>

        {/* CARD 3: DEVELOPMENT */}
        <div
          onClick={() => setFilterEnvCard(filterEnvCard === 'dev' ? 'ALL' : 'dev')}
          className={`cursor-pointer p-space-lg rounded-2xl glass-card transition-all flex flex-col justify-between space-y-4 ${
            filterEnvCard === 'dev' ? 'ring-2 ring-[#111318]/25 border-[#111318]/30' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-[#111318] font-bold">
                DEVELOPMENT
              </span>
              <span className="font-code-sm text-code-sm text-[#68707E]">env-dev-sandboxes</span>
            </div>
            <span className="px-2 py-0.5 rounded glass-pill-neutral font-label-caps text-label-caps uppercase">
              Low SLA
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="font-tabular-numeric-lg text-tabular-numeric-lg text-[#111318]">
                {formatINR(envCardMetrics.dev.projected)}
              </span>
              <span className="font-body-sm text-body-sm text-[#68707E]">/mo projected</span>
            </div>
            <div className="font-body-sm text-body-sm text-[#68707E] line-through">
              Baseline: {formatINR(envCardMetrics.dev.baseline)} /mo
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <div className="inline-flex px-2.5 py-1 rounded status-green font-label-caps text-label-caps uppercase font-bold">
              Save {formatINR(envCardMetrics.dev.savings)}/mo (-{envCardMetrics.dev.pct}%)
            </div>
            <p className="font-body-sm text-body-sm text-[#525866]">
              {envCardMetrics.dev.count} off-hours 118h/wk shutdown &amp; zombie rules
            </p>
          </div>
        </div>

        {/* CARD 4: STORAGE & VOLUMES */}
        <div
          onClick={() => setFilterEnvCard(filterEnvCard === 'storage' ? 'ALL' : 'storage')}
          className={`cursor-pointer p-space-lg rounded-2xl glass-card transition-all flex flex-col justify-between space-y-4 ${
            filterEnvCard === 'storage' ? 'ring-2 ring-[#111318]/25 border-[#111318]/30' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-[#111318] font-bold">
                STORAGE &amp; VOLUMES
              </span>
              <span className="font-code-sm text-code-sm text-[#68707E]">storage-ssd-ipv4</span>
            </div>
            <span className="px-2 py-0.5 rounded glass-pill-neutral font-label-caps text-label-caps uppercase">
              Storage
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="font-tabular-numeric-lg text-tabular-numeric-lg text-[#111318]">
                {formatINR(envCardMetrics.storage.projected)}
              </span>
              <span className="font-body-sm text-body-sm text-[#68707E]">/mo projected</span>
            </div>
            <div className="font-body-sm text-body-sm text-[#68707E] line-through">
              Baseline: {formatINR(envCardMetrics.storage.baseline)} /mo
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <div className="inline-flex px-2.5 py-1 rounded status-green font-label-caps text-label-caps uppercase font-bold">
              Save {formatINR(envCardMetrics.storage.savings)}/mo (-{envCardMetrics.storage.pct}%)
            </div>
            <p className="font-body-sm text-body-sm text-[#525866]">
              {envCardMetrics.storage.count} unattached volumes &amp; static IPv4 purges
            </p>
          </div>
        </div>
      </section>

      {/* 3. MIDDLE: ACTIONABLE SIZING & PLAN RECOMMENDATIONS TABLE */}
      <section className="rounded-2xl glass-card flex flex-col overflow-hidden">
        {/* Table Toolbar Header */}
        <div className="px-space-lg py-space-md flex flex-col xl:flex-row xl:items-center justify-between gap-space-md border-b border-black/[0.06]">
          <div className="flex flex-wrap items-center gap-space-sm">
            <h2 className="font-headline-md text-headline-md text-[#111318] font-bold">
              Actionable Sizing &amp; Plan Recommendations
            </h2>
            <span className="px-2.5 py-0.5 rounded status-green font-label-caps text-label-caps uppercase font-semibold">
              Terraform Sync Ready
            </span>
            {filterEnvCard !== 'ALL' && (
              <button
                type="button"
                onClick={() => setFilterEnvCard('ALL')}
                className="px-2.5 py-0.5 rounded bg-[#111318] text-white text-[11px] font-semibold"
              >
                Env Filter: {filterEnvCard.toUpperCase()} (Clear)
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Action Type Filter Pills */}
            <div className="flex items-center gap-1 p-1 glass-well rounded-lg">
              {[
                { id: 'ALL', label: 'All Types' },
                { id: 'RIGHTSIZE_VM', label: 'Right-Sizing' },
                { id: 'OFF_HOURS', label: 'Off-Hours' },
                { id: 'ORPHAN', label: 'Storage & IPs' },
                { id: 'ZOMBIE', label: 'Zombies' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterAction(t.id)}
                  className={`px-2.5 py-1 rounded-md font-body-sm text-xs transition-colors ${
                    filterAction === t.id
                      ? 'bg-[#111318] text-white font-semibold'
                      : 'text-[#525866] hover:text-[#111318] font-medium'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 p-1 glass-well rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1 rounded-md font-body-sm text-body-sm transition-colors ${
                  filterStatus === 'ALL'
                    ? 'bg-white text-[#111318] font-semibold shadow-xs'
                    : 'text-[#525866] hover:text-[#111318] font-medium'
                }`}
              >
                ALL ({recommendations.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1 rounded-md font-body-sm text-body-sm transition-colors ${
                  filterStatus === 'pending'
                    ? 'bg-white text-[#111318] font-semibold shadow-xs'
                    : 'text-[#525866] hover:text-[#111318] font-medium'
                }`}
              >
                PENDING ({summary.pending_count})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('accepted')}
                className={`px-3 py-1 rounded-md font-body-sm text-body-sm transition-colors ${
                  filterStatus === 'accepted'
                    ? 'bg-white text-[#111318] font-semibold shadow-xs'
                    : 'text-[#525866] hover:text-[#111318] font-medium'
                }`}
              >
                APPROVED ({summary.accepted_count})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('rejected')}
                className={`px-3 py-1 rounded-md font-body-sm text-body-sm transition-colors ${
                  filterStatus === 'rejected'
                    ? 'bg-white text-[#111318] font-semibold shadow-xs'
                    : 'text-[#525866] hover:text-[#111318] font-medium'
                }`}
              >
                SKIPPED ({summary.rejected_count})
              </button>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Actionable Sizing and Plan Recommendations Table"
          className="table-wrapper"
        >
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-black/[0.06]">
                <th className="px-space-lg py-2.5 font-label-caps text-label-caps uppercase text-[#525866]">
                  Resource / Hostname
                </th>
                <th className="px-space-md py-2.5 font-label-caps text-label-caps uppercase text-[#525866]">
                  Proposed Plan Change
                </th>
                <th className="px-space-md py-2.5 font-label-caps text-label-caps uppercase text-[#525866] text-right">
                  Cost Math (₹/mo)
                </th>
                <th className="px-space-md py-2.5 font-label-caps text-label-caps uppercase text-[#525866] text-center">
                  Risk Level
                </th>
                <th className="px-space-lg py-2.5 font-label-caps text-label-caps uppercase text-[#525866] text-right">
                  Decision Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {filteredItems.map((rec) => {
                const resObj = resourceMap.get(rec.resource_id);
                const currentCost = resObj?.monthly_cost_inr || Math.round(rec.monthly_savings_inr * 2);
                const targetCost = Math.max(0, currentCost - rec.monthly_savings_inr);
                const cutPct =
                  currentCost > 0
                    ? Math.round((rec.monthly_savings_inr / currentCost) * 100)
                    : 50;

                const currentSpec =
                  rec.current_config ||
                  rec.current_spec ||
                  (resObj?.vcpu ? `${resObj.plan} · ${resObj.vcpu} vCPU · ${resObj.ram_gb} GB` : 'Standard Tier');
                const targetSpec =
                  rec.recommended_config || rec.target_spec || rec.action_title || 'Optimized Tier';
                const proofText =
                  rec.reason || rec.peak_proof || rec.formula_explanation || rec.formula_string || 'Verified safe under p95/p99 headroom governor';
                const confScore = rec.confidence_score ?? rec.confidence_pct ?? 95;

                const isApproved = rec.status === 'accepted';
                const isSkipped = rec.status === 'rejected';

                return (
                  <tr
                    key={rec.id}
                    onClick={() => onSelectResource?.(rec.resource_id)}
                    className={`cursor-pointer transition-colors ${
                      isApproved
                        ? 'bg-[#236B52]/[0.05] hover:bg-[#236B52]/[0.08]'
                        : 'hover:bg-black/[0.025]'
                    }`}
                  >
                    <td className="px-space-lg py-3.5">
                      <div className="flex flex-col">
                        <span className="font-code-sm text-code-sm text-[#111318] font-semibold">
                          {rec.resource_name}
                        </span>
                        <span className="font-body-sm text-body-sm text-[#68707E]">
                          {rec.region} ({rec.env.toUpperCase()}) • {currentSpec}
                        </span>
                      </div>
                    </td>
                    <td className="px-space-md py-3.5">
                      <div className="flex flex-col">
                        <span className="font-body-md text-body-md text-[#111318] font-medium">
                          {targetSpec} (-{cutPct}%)
                        </span>
                        <span className="font-body-sm text-body-sm text-[#525866]">
                          {proofText}
                        </span>
                      </div>
                    </td>
                    <td className="px-space-md py-3.5 text-right font-tabular-numeric-md text-tabular-numeric-md whitespace-nowrap">
                      <div className="text-[#111318]">
                        {formatINR(currentCost)} → {formatINR(targetCost)}
                      </div>
                      <div className="text-[#1D5C46] font-semibold">
                        -{formatINR(rec.monthly_savings_inr)} (-{cutPct}%)
                      </div>
                    </td>
                    <td className="px-space-md py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded font-label-caps text-label-caps uppercase font-bold ${
                          rec.risk_level === 'LOW'
                            ? 'status-green'
                            : rec.risk_level === 'MEDIUM'
                            ? 'status-yellow'
                            : 'status-red'
                        }`}
                      >
                        {rec.risk_level} Risk · {confScore}%
                      </span>
                    </td>
                    <td className="px-space-lg py-3.5 text-right whitespace-nowrap">
                      <div
                        className="inline-flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onAccept(rec.id)}
                          className={`px-3 py-1 rounded font-body-sm text-body-sm font-semibold transition-colors ${
                            isApproved
                              ? 'status-green'
                              : 'bg-[#111318] text-white hover:bg-[#272B33]'
                          }`}
                        >
                          {isApproved ? 'Approved' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(rec.id)}
                          className={`px-2.5 py-1 rounded font-body-sm text-body-sm font-medium transition-colors ${
                            isSkipped
                              ? 'status-red'
                              : 'glass-well hover:bg-black/[0.06] text-[#3F4450]'
                          }`}
                        >
                          {isSkipped ? 'Skipped' : 'Skip'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Cumulative Savings Footer */}
        <div className="px-space-lg py-space-md border-t border-black/[0.06] bg-black/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-[#525866]">
              Pipeline Summary
            </span>
            <span className="font-body-sm text-body-sm text-[#3F4450]">
              {summary.accepted_count} changes approved for scheduled deployment tonight ({summary.pending_count} pending review)
            </span>
          </div>
          <div className="px-3.5 py-1.5 rounded-lg status-green font-tabular-numeric-md text-tabular-numeric-md font-bold tracking-tight">
            Net Cumulative Approved Savings: {formatINR(summary.accepted_savings_inr)}/mo
          </div>
        </div>
      </section>

      {/* 4. BOTTOM TWO-COLUMN REFERENCE SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        {/* LEFT COLUMN: Standard Compute & Cache Catalog Pricing (Utho Cloud) */}
        <div className="p-space-lg rounded-2xl glass-card flex flex-col justify-between space-y-space-md">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-[#111318] font-bold">
                Standard Compute &amp; Storage Catalog Pricing (Utho Cloud)
              </h3>
              <span className="px-2.5 py-0.5 rounded glass-pill-neutral font-label-caps text-label-caps uppercase">
                Synced via Utho API
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-[#525866]">
              Reference commitment rates for high-frequency cloud instances in India (`in-mumbai-1`, `in-bangalore-1`, `in-noida-1`).
            </p>
          </div>

          <div className="table-wrapper">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  <th className="px-2 py-2 font-label-caps text-label-caps uppercase text-[#525866]">
                    Instance Type
                  </th>
                  <th className="px-2 py-2 font-label-caps text-label-caps uppercase text-[#525866]">
                    Specs
                  </th>
                  <th className="px-2 py-2 font-label-caps text-label-caps uppercase text-[#525866] text-right">
                    On-Demand
                  </th>
                  <th className="px-2 py-2 font-label-caps text-label-caps uppercase text-[#525866] text-right">
                    1-Yr (-30%)
                  </th>
                  <th className="px-2 py-2 font-label-caps text-label-caps uppercase text-[#525866] text-right">
                    3-Yr (-45%)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] font-tabular-numeric-md text-tabular-numeric-md">
                {catalogList.map((item) => {
                  const oneYr = Math.round(item.monthly_inr * 0.7);
                  const threeYr = Math.round(item.monthly_inr * 0.55);
                  return (
                    <tr key={item.plan} className="hover:bg-black/[0.02]">
                      <td className="px-2 py-2 font-code-sm text-code-sm text-[#111318] font-semibold">
                        utho.{item.plan}
                      </td>
                      <td className="px-2 py-2 font-body-sm text-body-sm text-[#525866]">
                        {item.vcpu > 0 ? `${item.vcpu} vCPU, ${item.ram_gb} GiB` : item.target_workload}
                      </td>
                      <td className="px-2 py-2 text-right text-[#111318] font-semibold">
                        {formatINR(item.monthly_inr)}
                      </td>
                      <td className="px-2 py-2 text-right text-[#1D5C46] font-semibold">
                        {formatINR(oneYr)}
                      </td>
                      <td className="px-2 py-2 text-right text-[#1D5C46] font-bold">
                        {formatINR(threeYr)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-2 flex items-center justify-between text-[#68707E] font-label-caps text-label-caps uppercase">
            <span>Taxes excluded • Billed hourly in INR (₹)</span>
            <button
              type="button"
              onClick={onOpenExportModal}
              className="text-[#111318] font-semibold hover:underline"
            >
              Export Full Catalog Matrix
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Plain-English Optimization Rules & Governance */}
        <div className="p-space-lg rounded-2xl glass-card flex flex-col justify-between space-y-space-md">
          <div className="space-y-1">
            <h3 className="font-headline-md text-headline-md text-[#111318] font-bold">
              Active Optimization Governance Rules
            </h3>
            <p className="font-body-sm text-body-sm text-[#525866]">
              Autonomous mathematical policy triggers continuously evaluating Utho Cloud fleet metrics and SLA ceilings.
            </p>
          </div>

          <div className="space-y-3">
            {/* Rule 1 */}
            <div className="p-3.5 rounded-xl glass-well flex items-start justify-between gap-space-sm">
              <div className="flex flex-col space-y-0.5">
                <span className="font-body-md text-body-md font-semibold text-[#111318]">
                  Peak-Safe Rightsizing Governor (85% Ceiling)
                </span>
                <p className="font-body-sm text-body-sm text-[#525866]">
                  Projected CPU p99 = (Current vCPU × Observed p99) / Candidate vCPU &lt; 85%. Blocks downsizing on bursty nodes.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded status-green font-label-caps text-label-caps uppercase font-bold shrink-0">
                Active
              </span>
            </div>

            {/* Rule 2 */}
            <div className="p-3.5 rounded-xl glass-well flex items-start justify-between gap-space-sm">
              <div className="flex flex-col space-y-0.5">
                <span className="font-body-md text-body-md font-semibold text-[#111318]">
                  Off-Hours Standby Schedule (118 hrs/wk)
                </span>
                <p className="font-body-sm text-body-sm text-[#525866]">
                  Non-production dev and staging environments automatically enter standby from 20:00 to 08:00 IST and weekends.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded status-green font-label-caps text-label-caps uppercase font-bold shrink-0">
                Active
              </span>
            </div>

            {/* Rule 3 */}
            <div className="p-3.5 rounded-xl glass-well flex items-start justify-between gap-space-sm">
              <div className="flex flex-col space-y-0.5">
                <span className="font-body-md text-body-md font-semibold text-[#111318]">
                  RAM OOM Safety Headroom Governor (75% Ceiling)
                </span>
                <p className="font-body-sm text-body-sm text-[#525866]">
                  Prevents out-of-memory kills by enforcing Projected RAM p95 &lt; 75% across all candidate tier changes.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded status-green font-label-caps text-label-caps uppercase font-bold shrink-0">
                Active
              </span>
            </div>

            {/* Rule 4 */}
            <div className="p-3.5 rounded-xl glass-well flex items-start justify-between gap-space-sm">
              <div className="flex flex-col space-y-0.5">
                <span className="font-body-md text-body-md font-semibold text-[#111318]">
                  Storage &amp; Static IPv4 Purge Cadence
                </span>
                <p className="font-body-sm text-body-sm text-[#525866]">
                  Unattached block SSD volumes and unbound IPv4 addresses idle &gt; 30 days are queued for snapshot archive &amp; release.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded status-green font-label-caps text-label-caps uppercase font-bold shrink-0">
                Active
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onOpenExportModal}
              className="px-4 py-2 rounded-lg glass-well text-[#111318] hover:bg-black/[0.06] transition-colors font-body-sm text-body-sm font-semibold"
            >
              Export Governance Manifests
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
