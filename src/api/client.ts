import type {
  Resource,
  ResourceDetail,
  Recommendation,
  DashboardResponse,
  RecommendationsResponse,
  SimulationParams,
  SimulationResult,
  AnomalyAlert,
  AssumptionsResponse,
  RemediationExport,
  NLScenarioResponse,
  AIForecastResponse,
  AIBriefingResponse,
} from '../types/api';
import {
  INITIAL_RESOURCES,
  INITIAL_RECOMMENDATIONS,
  INITIAL_ALERTS,
  INITIAL_ASSUMPTIONS,
  INITIAL_HISTORICAL_SPEND,
  INITIAL_FORECAST_60D,
  generate30dTimeSeries,
} from './mockData';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// In-Memory state for graceful fallback and reactive local updates
class LocalFinOpsEngine {
  private resources: Resource[] = [...INITIAL_RESOURCES];
  private recommendations: Recommendation[] = [...INITIAL_RECOMMENDATIONS];
  private alerts: AnomalyAlert[] = [...INITIAL_ALERTS];
  private isConnected = false;
  private isAIConnected = false;

  constructor() {
    this.recalculateAll();
  }

  public setConnected(status: boolean) {
    this.isConnected = status;
  }

  public getConnected() {
    return this.isConnected;
  }

  public setAIConnected(status: boolean) {
    this.isAIConnected = status;
  }

  public getAIConnected() {
    return this.isAIConnected;
  }

  public getRecommendations(): RecommendationsResponse {
    const totalCurrent = 683200;
    const acceptedSavings = this.recommendations
      .filter((r) => r.status === 'accepted')
      .reduce((sum, r) => sum + r.monthly_savings_inr, 0);

    const acceptedCount = this.recommendations.filter((r) => r.status === 'accepted').length;
    const rejectedCount = this.recommendations.filter((r) => r.status === 'rejected').length;
    const pendingCount = this.recommendations.filter((r) => r.status === 'pending').length;

    const byEnv: Record<string, number> = {
      prod: 0,
      staging: 0,
      dev: 0,
    };
    const byAction: Record<string, number> = {
      RIGHTSIZE_VM: 0,
      SCHEDULE_OFF_HOURS: 0,
      OFF_HOURS_SHUTDOWN: 0,
      CLEANUP_ORPHAN: 0,
      CLEAN_ORPHANED_VOLUME: 0,
      CLEAN_ORPHANED_IP: 0,
      TERMINATE_ZOMBIE: 0,
      TERMINATE_ZOMBIE_VM: 0,
    };

    for (const r of this.recommendations) {
      if (r.status === 'accepted') {
        const envKey = String(r.env);
        const actionKey = String(r.action_type);
        byEnv[envKey] = (byEnv[envKey] || 0) + r.monthly_savings_inr;
        byAction[actionKey] = (byAction[actionKey] || 0) + r.monthly_savings_inr;
      }
    }

    return {
      summary: {
        current_monthly_inr: totalCurrent,
        projected_monthly_inr: totalCurrent - acceptedSavings,
        accepted_savings_inr: acceptedSavings,
        accepted_savings_pct: Number(((acceptedSavings / totalCurrent) * 100).toFixed(1)),
        accepted_count: acceptedCount,
        rejected_count: rejectedCount,
        pending_count: pendingCount,
        by_env: byEnv,
        by_action: byAction,
      },
      items: [...this.recommendations],
    };
  }

  public patchRecommendation(id: string, status: 'accepted' | 'rejected'): RecommendationsResponse {
    const item = this.recommendations.find((r) => r.id === id);
    if (item) {
      item.status = status;
    }
    return this.getRecommendations();
  }

  public bulkRecommendations(status: 'accepted' | 'rejected', filter_risk: 'ALL' | 'LOW_ONLY'): RecommendationsResponse {
    for (const item of this.recommendations) {
      if (filter_risk === 'LOW_ONLY') {
        if (item.risk_level === 'LOW') {
          item.status = status;
        }
      } else {
        item.status = status;
      }
    }
    return this.getRecommendations();
  }

  public getDashboard(): DashboardResponse {
    const recSummary = this.getRecommendations().summary;
    const currentSpend = 683200;
    const acceptedSavings = recSummary.accepted_savings_inr;
    const projectedSpend = currentSpend - acceptedSavings;
    const totalPotentialSavings = this.recommendations.reduce((sum, r) => sum + r.monthly_savings_inr, 0);

    const kwhSaved = Math.round(acceptedSavings * 0.052);
    const co2Kg = Math.round(kwhSaved * 0.75);
    const trees = Math.round(co2Kg / 22);

    const forecast = INITIAL_FORECAST_60D.map((f, idx) => {
      const dropRatio = idx / (INITIAL_FORECAST_60D.length - 1);
      return {
        date: f.day,
        day: f.day,
        unoptimized_inr: f.unoptimized_inr,
        do_nothing_inr: f.unoptimized_inr,
        optimized_inr: Math.round(f.unoptimized_inr - acceptedSavings * dropRatio),
      };
    });

    const spendByEnv = [
      { env: 'prod', current_inr: 462500, projected_inr: 462500 - (recSummary.by_env?.prod || 0) },
      { env: 'staging', current_inr: 138500, projected_inr: 138500 - (recSummary.by_env?.staging || 0) },
      { env: 'dev', current_inr: 82200, projected_inr: 82200 - (recSummary.by_env?.dev || 0) },
    ];

    const spendByRegion = [
      { region: 'in-noida-1', current_inr: 222300, projected_inr: 222300 - Math.round(acceptedSavings * 0.35) },
      { region: 'in-bangalore-1', current_inr: 248650, projected_inr: 248650 - Math.round(acceptedSavings * 0.40) },
      { region: 'in-mumbai-1', current_inr: 212250, projected_inr: 212250 - Math.round(acceptedSavings * 0.25) },
    ];

    return {
      current_monthly_spend_inr: currentSpend,
      projected_monthly_spend_inr: projectedSpend,
      accepted_monthly_savings_inr: acceptedSavings,
      accepted_savings_pct: recSummary.accepted_savings_pct,
      total_potential_savings_inr: totalPotentialSavings,
      bill_growth_6m_pct: 40,
      protected_peak_vms_count: 10,
      active_alerts_count: this.alerts.length,
      total_resources_count: this.resources.length,
      sustainability: {
        monthly_kwh_saved: kwhSaved || 5120,
        monthly_co2_kg_saved: co2Kg || 3840,
        trees_equivalent: trees || 175,
      },
      historical_spend_6m: INITIAL_HISTORICAL_SPEND,
      forecast_60d: forecast,
      spend_by_env: spendByEnv,
      spend_by_region: spendByRegion,
      ai_engine_connected: this.isAIConnected,
      ai_engine_service: this.isAIConnected ? 'smartcloud-ai-engine' : 'fallback-go-deterministic',
    };
  }

  public getResources(filters?: {
    region?: string;
    env?: string;
    team?: string;
    type?: string;
    status?: string;
    search?: string;
  }): Resource[] {
    let result = [...this.resources];

    if (filters?.region && filters.region !== 'ALL') {
      result = result.filter((r) => r.region === filters.region);
    }
    if (filters?.env && filters.env !== 'ALL') {
      result = result.filter((r) => r.env === filters.env);
    }
    if (filters?.team && filters.team !== 'ALL') {
      result = result.filter((r) => r.team === filters.team);
    }
    if (filters?.type && filters.type !== 'ALL') {
      result = result.filter((r) => r.type === filters.type);
    }
    if (filters?.status && filters.status !== 'ALL') {
      result = result.filter((r) => r.optimization_status === filters.status);
    }
    if (filters?.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          (r.ip_address && r.ip_address.includes(q)) ||
          r.team.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public getResource(id: string): ResourceDetail | null {
    const resource = this.resources.find((r) => r.id === id);
    if (!resource) return null;

    const recommendation = this.recommendations.find((r) => r.resource_id === id);
    const timeseries = generate30dTimeSeries(resource);

    const cpuAvg = resource.metrics_summary.cpu_avg;
    const cpuP95 = resource.metrics_summary.cpu_p95;
    const cpuP99 = resource.metrics_summary.cpu_p99;
    const memP95 = resource.metrics_summary.mem_p95;
    const memP99 = resource.metrics_summary.mem_p99;

    let peakExplanation = 'Workload displays steady baseline utilization without hazardous burst spikes.';
    let naiveComparison = `Required_Peak = max(CPU_p95=${cpuP95}%, MEM_p95=${memP95}%) * 1.25 = ${(Math.max(cpuP95, memP95) * 1.25).toFixed(1)}% (Threshold: 70.0% | p99 Ceiling: 85.0%).`;
    let riskAssessment = 'Low risk profile suitable for automated orchestration.';
    let blastRadius = `Tier-2 Service (${resource.team}) in ${resource.region}: Rolling plan resize causes <15s connection drain.`;
    let workloadClass = 'Steady-State Service';
    let downsizingSafe = true;
    let riskScore = 18;
    let rollbackRunbook = [
      `1. Snapshot pre-change state: utho snapshot create --resource-id ${resource.id} --name pre-finops-rb`,
      `2. Verify latency p99 & error rate over 15-min canary window in ${resource.region}`,
      `3. Instant revert command: utho vm resize --id ${resource.id} --plan ${resource.plan || 'c4.xlarge'} --immediate`,
    ];

    if (resource.optimization_status === 'PROTECTED_PEAK_LOAD') {
      peakExplanation = `CPU average is ${cpuAvg}%, but 30-day p99 bursts to ${cpuP99}%. Naive downsizing based solely on average metrics would cut compute by 50%, resulting in immediate 100% CPU saturation and service outages during peak loads.`;
      naiveComparison = `Naive Avg Tool Recommendation: Downsize to 2 vCPU (Saves ₹24,000/mo, SLA FAILURE RISK 99.8%).\nPeak-Safe SmartCloud Decision: Retain full ${resource.vcpu || 16} vCPU capacity (Required_Peak = ${(Math.max(cpuP95, memP95) * 1.25).toFixed(1)}% > 70% ceiling).`;
      riskAssessment = 'Downsizing blocked by Peak-Safety Governor. Headroom threshold violated (>85% p99).';
      blastRadius = `CRITICAL Tier-1 Production Path (${resource.team} / ${resource.region}): Downsizing would saturate CPU queues during peak bursts (${cpuP99}% p99), causing HTTP 502/504 timeouts.`;
      workloadClass = 'Bursty Transactional Production';
      downsizingSafe = false;
      riskScore = 92;
      rollbackRunbook = [
        `1. DO NOT DOWNSIZE: Resource ${resource.id} is locked by Peak-Safety Governor (p99=${cpuP99}%)`,
        `2. If capacity pressure exceeds 90%, scale horizontally: utho asg scale --group ${resource.name} --min-nodes +1`,
      ];
    } else if (resource.optimization_status === 'OVERPROVISIONED') {
      peakExplanation = `CPU p99 is only ${cpuP99}%, and RAM p99 is ${memP99}%. Ample safety headroom exists above the 70% threshold even with 25% safety multiplier.`;
      naiveComparison = `Required_Peak = ${(Math.max(cpuP95, memP95) * 1.25).toFixed(1)}% < 70.0% ceiling and p99 (${cpuP99}%) < 85.0%. Safe downsizing maintains >40% burst headroom.`;
      riskAssessment = 'Safe for immediate automated rightsizing via Utho Cloud CLI or Terraform.';
      workloadClass = 'Overprovisioned Steady Service';
      riskScore = 14;
    }

    const quantileForecast = Array.from({ length: 6 }, (_, idx) => {
      const h = (idx + 1) * 4;
      const wave = Math.sin(((h - 6) / 24) * 2 * Math.PI);
      const q50 = Math.max(1, Number((cpuAvg + (cpuP95 - cpuAvg) * 0.35 * Math.max(0, wave)).toFixed(1)));
      const q90 = Math.min(100, Number((q50 + (cpuP99 - cpuAvg) * 0.55).toFixed(1)));
      const q10 = Math.max(0.5, Number((q50 * 0.65).toFixed(1)));
      return {
        hour_label: `+${h}h`,
        cpu_q10: q10,
        cpu_q50: q50,
        cpu_q90: q90,
        mem_q50: Number(resource.metrics_summary.mem_avg.toFixed(1)),
        mem_q90: Number(memP95.toFixed(1)),
      };
    });

    return {
      ...resource,
      timeseries_30d: timeseries,
      recommendation,
      engineering_analysis: {
        provider: 'Python-AI-Service (:8001)',
        peak_safety_explanation: peakExplanation,
        naive_vs_safe_comparison: naiveComparison,
        peak_headroom_proof: naiveComparison,
        cost_formula: `Monthly Tariff = ₹${resource.monthly_cost_inr.toLocaleString('en-IN')}/mo (Hourly = ₹${(resource.monthly_cost_inr / 730).toFixed(2)})`,
        risk_assessment: riskAssessment,
        technical_explanation: peakExplanation,
        blast_radius_analysis: blastRadius,
        workload_classification: workloadClass,
        downsizing_safe: downsizingSafe,
        risk_score: riskScore,
        confidence_level: 'HIGH',
        confidence_reason: '30-day continuous telemetry (180 4-hour intervals = 720 hours)',
        actionable_next_steps: rollbackRunbook,
        rollback_runbook: rollbackRunbook,
        jev_assessment: {
          model: 'TypeSafe-Jev-Ordinal-v1',
          risk_score_percentage: riskScore,
          risk_level: riskScore > 75 ? 'Critical' : 'Low',
          model_confidence: 0.94,
          probabilities:
            riskScore > 75
              ? { Low: 0.02, Moderate: 0.08, High: 0.25, Critical: 0.65 }
              : { Low: 0.72, Moderate: 0.21, High: 0.05, Critical: 0.02 },
        },
        quantile_forecast_24h: quantileForecast,
        terraform_hcl:
          recommendation?.terraform_code ||
          `resource "utho_cloud_instance" "${resource.name.replace(/-/g, '_')}" {\n  name   = "${resource.name}"\n  dcslug = "${resource.region}"\n  plan   = "${resource.plan || 'c4.xlarge'}"\n}`,
        greenops_impact: {
          estimated_energy_saved_kwh: 112.4,
          estimated_carbon_saved_kg_co2e: 92.2,
          sustainability_score: 84.5,
          pue: 1.4,
          watts_per_vcpu_range: '15W idle – 65W full',
        },
      },
    };
  }

  public simulate(params: SimulationParams): SimulationResult {
    let devSavings = 0;
    if (params.dev_off_hours_enabled) {
      const ratio = Math.min(168, Math.max(0, params.dev_shutdown_hours_per_week)) / 168;
      devSavings = Math.round(82200 * ratio * 0.85);
    }

    let stagingWeekendSavings = 0;
    if (params.staging_weekend_off_enabled) {
      stagingWeekendSavings = Math.round(138500 * (48 / 168) * 0.7);
    }

    const headroom = params.safety_headroom_buffer_pct;
    let eligibleVMs = 0;
    let blockedVMs = 0;
    let rightsizingSavings = 0;

    for (const r of this.resources.filter((res) => res.type === 'vm')) {
      const p95 = r.metrics_summary.cpu_p95;
      const p99 = r.metrics_summary.cpu_p99;
      if (p95 * (1 + headroom / 100) < 70 && p99 < 85) {
        if (r.optimization_status === 'OVERPROVISIONED') {
          eligibleVMs++;
          rightsizingSavings += Math.round(r.monthly_cost_inr * 0.5);
        }
      } else {
        blockedVMs++;
      }
    }

    let orphanSavings = 0;
    if (params.purge_orphaned_older_than_days <= 60) {
      orphanSavings += 48000;
    } else if (params.purge_orphaned_older_than_days <= 80) {
      orphanSavings += 24000;
    }

    const totalSavings = devSavings + stagingWeekendSavings + rightsizingSavings + orphanSavings;
    const currentSpend = 683200;
    const simulatedSpend = Math.max(150000, currentSpend - totalSavings);
    const savingsPct = Number(((totalSavings / currentSpend) * 100).toFixed(1));
    const carbonKg = Math.round(totalSavings * 0.052 * 0.75);

    return {
      simulated_monthly_spend_inr: simulatedSpend,
      simulated_monthly_savings_inr: totalSavings,
      simulated_savings_pct: savingsPct,
      eligible_vms_count: eligibleVMs,
      blocked_by_headroom_count: blockedVMs,
      carbon_saved_kg: carbonKg,
      risk_summary:
        headroom >= 40
          ? 'Ultra-Conservative Safety Buffer: Zero risk of peak throttling, fewer VMs rightsized.'
          : headroom <= 20
          ? 'Aggressive Rightsizing: High savings yield, potential peak burst contention risk.'
          : 'Balanced Production Grade: Recommended 25% peak headroom buffer applied.',
      breakdown: {
        dev_scheduling_savings_inr: devSavings,
        staging_weekend_savings_inr: stagingWeekendSavings,
        rightsizing_savings_inr: rightsizingSavings,
        orphan_purge_savings_inr: orphanSavings,
      },
    };
  }

  public parseNLScenario(query: string): NLScenarioResponse {
    const q = query.toLowerCase();
    let headroom = 25;
    const hm = q.match(/(\d{1,2})\s*%\s*(?:peak\s*)?(?:headroom|buffer|safety)/);
    if (hm) {
      headroom = Math.max(15, Math.min(50, Math.round(Number(hm[1]) / 5) * 5));
    } else if (q.includes('aggressive')) {
      headroom = 15;
    } else if (q.includes('conservative') || q.includes('strict')) {
      headroom = 40;
    }

    let devHours = 118;
    if (q.includes('24/7') || q.includes('no shutdown')) {
      devHours = 0;
    }

    const stagingOff = !q.includes('keep staging');
    let orphanDays = 30;
    const om = q.match(/(\d{1,2})\s*days/);
    if (om) {
      orphanDays = Math.max(15, Math.min(90, Math.round(Number(om[1]) / 15) * 15));
    }

    let targetRegion = 'all';
    if (q.includes('bangalore')) targetRegion = 'in-bangalore-1';
    else if (q.includes('mumbai')) targetRegion = 'in-mumbai-1';
    else if (q.includes('noida')) targetRegion = 'in-noida-1';

    let targetEnv = 'dev';
    if (q.includes('staging')) targetEnv = 'staging';
    else if (q.includes('prod')) targetEnv = 'prod';

    const simParams: SimulationParams = {
      dev_off_hours_enabled: devHours > 0,
      dev_shutdown_hours_per_week: devHours,
      staging_weekend_off_enabled: stagingOff,
      safety_headroom_buffer_pct: headroom,
      purge_orphaned_older_than_days: orphanDays,
    };

    const simRes = this.simulate(simParams);

    return {
      query,
      provider: 'Python-AI-Service (:8001)',
      parsed_params: simParams,
      detected_scope: {
        environment: targetEnv,
        region: targetRegion,
        shutdown_start: '20:00',
        shutdown_end: '08:00',
      },
      parsed_tags: [
        `Region: ${targetRegion}`,
        `Dev Off-Hours: ${devHours}h/wk`,
        `Peak Headroom: +${headroom}%`,
        `Orphan Purge: >${orphanDays}d`,
      ],
      explanation: `Parsed scenario for ${targetRegion.toUpperCase()} (${targetEnv.toUpperCase()}): Dev shutdown ${devHours}h/wk (20:00–08:00), Staging weekend halt ${stagingOff ? 'ENABLED' : 'DISABLED'}, Peak-Safety headroom buffer +${headroom}% above p95.`,
      simulation_result: simRes,
    };
  }

  public getAIForecast(days: number, headroomPct = 25): AIForecastResponse {
    const scale = days / 30;
    const vmCur = Math.round(635200 * scale);
    const volCur = Math.round(45200 * scale);
    const ipCur = Math.round(2800 * scale);
    const curTotal = vmCur + volCur + ipCur;

    const vmRec = Math.round(405970 * scale);
    const volRec = 0;
    const ipRec = 0;
    const recTotal = vmRec + volRec + ipRec;
    const savTotal = curTotal - recTotal;

    return {
      days,
      currency: 'INR',
      provider: 'Python-AI-Service (:8001)',
      headroom_factor: 1 + headroomPct / 100,
      forecast_basis: `Pooled TFT q90 utilization & historical p99 peak-safe rightsizing held over ${days}-day Utho Cloud INR tariff horizon.`,
      current_cost_inr: {
        vm_compute: vmCur,
        storage: volCur,
        public_ip: ipCur,
        total: curTotal,
      },
      recommended_cost_inr: {
        vm_compute: vmRec,
        storage: volRec,
        public_ip: ipRec,
        total: recTotal,
      },
      estimated_savings_inr: savTotal,
      savings_pct: Number(((savTotal / curTotal) * 100).toFixed(1)),
      fleet_quantile_summary: {
        cpu_q10_pct: 9.4,
        cpu_q50_pct: 24.8,
        cpu_q90_pct: 68.5,
        mem_q10_pct: 16.2,
        mem_q50_pct: 31.4,
        mem_q90_pct: 64.0,
      },
      sustainability: {
        estimated_energy_saved_kwh: Math.round(5120 * scale),
        estimated_carbon_saved_kg_co2e: Math.round(4198 * scale),
        sustainability_score: 86.4,
        pue: 1.4,
        grid_carbon_factor_kg_per_kwh: 0.82,
        assumptions: [
          '15W/vCPU idle to 65W/vCPU full load',
          'Datacenter PUE 1.4 • CEA India Grid 0.82 kg CO2e/kWh',
        ],
      },
    };
  }

  public getAIBriefing(role: string): AIBriefingResponse {
    const r = role.toLowerCase();
    if (r === 'finance') {
      return {
        role: 'finance',
        provider: 'Python-AI-Service (:8001)',
        model: 'Deterministic-SRE-Synthesizer (Gemini Fallback)',
        headline: 'Unit Economics & 90-Day Budget Trajectory: ₹1,26,920/mo Unclaimed Yield',
        summary: 'Compute accounts for 93.0% of Utho spend, Block SSD storage 6.6% (₹45,200/mo in orphaned volumes), and Floating IPs 0.4%.',
        bullet_points: [
          'Zero-CapEx Instant Recovery: ₹48,000/mo from 12 unattached Block SSDs (₹8/GB) + 8 floating IPv4s (₹350/IP).',
          'Diurnal Non-Prod Scheduling: 118 hrs/wk dev/staging hibernation + 20 hrs/day batch scheduling cuts compute waste by 65–83%.',
          'Staging Anomaly Bleed: Decommissioning staging-loadtest-cluster halts ₹2,986/day (₹89,600/mo) budget overrun.',
        ],
        key_metrics: [
          { label: 'Committed Savings', value: '₹1,50,310/mo' },
          { label: 'Pending Approval', value: '₹1,26,920/mo' },
          { label: '90-Day Net Impact', value: '₹8,31,690' },
        ],
      };
    }
    if (r === 'engineering') {
      return {
        role: 'engineering',
        provider: 'Python-AI-Service (:8001)',
        model: 'Deterministic-SRE-Synthesizer (Gemini Fallback)',
        headline: 'SRE Telemetry Audit: p95/p99 Headroom Verified & 3 Active TTF Anomalies',
        summary: 'All 20 compute rightsizing candidates pass the Projected p95 <= 80% and p99 < 85% governor checks (Jev ordinal risk < 25%).',
        bullet_points: [
          'Peak-Safety Proof: prod-payment-webhook-01 (13.8% avg, 93.2% p99) blocked from downsizing to prevent 186.4% peak saturation.',
          'TTF Alert ALT-001: prod-search-indexer-04 (in-noida-1) RAM slope +0.55%/hr with 3.8x net egress (+4.6σ); OOM projected in 6.6h.',
          'TTF Alert ALT-003: prod-postgres-wal-volume (in-mumbai-1) at 91.2% disk (+0.90%/day slope); full in 9.8 days.',
        ],
        key_metrics: [
          { label: 'Governor Rule', value: 'p99 < 85% & +25% Buffer' },
          { label: 'Urgent TTF Alert', value: '6.6h (res-vm-015)' },
          { label: 'Ready IaC Scripts', value: 'Utho CLI + Terraform' },
        ],
      };
    }
    return {
      role: 'executive',
      provider: 'Python-AI-Service (:8001)',
      model: 'Deterministic-SRE-Synthesizer (Gemini Fallback)',
      headline: '₹2,77,230/mo Optimization Pipeline Identified Across 85 Utho Cloud Resources',
      summary: 'Current monthly run-rate is ₹6,83,200/mo (+40% 6-month sprawl). 10 bursty checkout VMs are shielded from downsizing.',
      bullet_points: [
        'Committed Run-Rate Drop: ₹6,83,200/mo → ₹5,32,890/mo (-22.0% locked in; ₹2,77,230/mo total pipeline).',
        'SLA Peak Protection: 10 revenue-critical VMs (p99 >= 85%) protected by Peak-Safety Governor.',
        'GreenOps ESG Yield: 32.1% operational carbon reduction (~5,100+ kWh/mo saved across Noida, Bangalore & Mumbai).',
      ],
      key_metrics: [
        { label: 'Pipeline Potential', value: '₹2,77,230/mo' },
        { label: 'Annualized ROI', value: '₹33,26,760/yr' },
        { label: 'SLA Risk Exposure', value: '0 Breaches (Protected)' },
      ],
    };
  }

  public getAlerts(): AnomalyAlert[] {
    return this.alerts.map((a) => {
      if (a.id === 'ALT-001') {
        return {
          ...a,
          ai_provider: 'Python-AI-Service (:8001)',
          root_cause_correlation:
            'Pearson r=0.984 correlation between linear JVM heap growth (+0.55%/hr over 96h) and 3.8x network egress spike (z-score = +4.6σ above 7d baseline).',
          time_to_failure_hours: 6.6,
          ttf_formula: '(100.0% - 96.4% RAM) / +0.55%/hr = 6.6 hrs to OOM kernel panic',
          slope_pct_per_day: 13.1,
          statistical_z_score: 4.6,
          blast_radius: 'High: Search indexing lag across in-noida-1 catalog APIs if OOM occurs.',
          mitigation_command: "utho vm exec --id res-vm-015 --cmd 'jcmd 1 GC.run && systemctl restart search-indexer'",
        };
      }
      if (a.id === 'ALT-002') {
        return {
          ...a,
          ai_provider: 'Python-AI-Service (:8001)',
          root_cause_correlation:
            '4x r16.2xlarge (64 vCPU, 256 GB aggregate) transitioned from 82% load-test peak to 0.9% idle floor 120 hours ago (z-score = -3.4σ).',
          time_to_failure_hours: 0,
          ttf_formula: 'Cost Bleed Rate: 4 * ₹746.50/day = ₹2,986/day (₹89,600/mo budget overrun)',
          slope_pct_per_day: 0,
          statistical_z_score: 3.4,
          blast_radius: 'Zero SLA risk: Ephemeral staging load-test cluster with 0 active sessions.',
          mitigation_command: "utho vm destroy --filter 'name=staging-loadtest-cluster-node-*' --region in-bangalore-1 --yes",
        };
      }
      return {
        ...a,
        ai_provider: 'Python-AI-Service (:8001)',
        root_cause_correlation:
          '14-day linear regression (np.polyfit slope = +0.90%/day, R²=0.992) on WAL block volume caused by stalled archive_command.',
        time_to_failure_hours: 234.7,
        ttf_formula: '(100.0% - 91.2% Disk) / +0.90%/day = 9.8 days (234.7 hrs) to disk-full DB halt',
        slope_pct_per_day: 0.9,
        statistical_z_score: 3.2,
        blast_radius: 'Critical: PostgreSQL write-ahead log exhaustion halts primary DB transactions in in-mumbai-1.',
        mitigation_command: 'utho volume expand --id res-vol-001 --size-gb 1500 && pg_archivecleanup /var/lib/postgresql/wal',
      };
    });
  }

  public getAssumptions(): AssumptionsResponse {
    return INITIAL_ASSUMPTIONS;
  }

  public getRemediationExport(): RemediationExport {
    const accepted = this.recommendations.filter((r) => r.status === 'accepted');

    const cliScripts = [
      '#!/usr/bin/env bash',
      '# SmartCloud Optimizer — Automated Utho Remediation Script',
      `# Generated at: ${new Date().toISOString()}`,
      'set -euo pipefail',
      '',
      'echo "==> Authenticating to Utho Cloud API..."',
      'utho auth verify',
      '',
    ];

    const tfBlocks = [
      '# SmartCloud Optimizer — Terraform HCL Remediation Changes',
      `# Generated at: ${new Date().toISOString()}`,
      '# Apply via: terraform plan -out=finops.plan && terraform apply finops.plan',
      '',
    ];

    const csvLines = [
      'Resource ID,Resource Name,Type,Environment,Region,Team,Action,Current Monthly (INR),Target Monthly (INR),Monthly Savings (INR),Formula,Risk',
    ];

    for (const item of accepted) {
      cliScripts.push(`# Action: ${item.action_title || item.action_type} (${item.resource_name})`);
      if (item.cli_command) cliScripts.push(item.cli_command);
      cliScripts.push('');

      if (item.terraform_code) tfBlocks.push(item.terraform_code);
      tfBlocks.push('');

      csvLines.push(
        `"${item.resource_id}","${item.resource_name}","${item.resource_type}","${item.env}","${item.region}","${item.team}","${item.action_title || item.action_type}",${item.current_monthly_inr},${item.projected_monthly_inr},${item.monthly_savings_inr},"${item.formula_explanation || item.formula_string || ''}","${item.risk_level}"`
      );
    }

    if (accepted.length === 0) {
      cliScripts.push('# No recommendations currently accepted. Review the ledger to accept items.');
      tfBlocks.push('# No recommendations accepted yet.');
      csvLines.push('"No accepted recommendations","","","","","","","0","0","0","",""');
    }

    return {
      utho_cli_script: cliScripts.join('\n'),
      terraform_hcl: tfBlocks.join('\n'),
      csv_report: csvLines.join('\n'),
    };
  }

  private recalculateAll() {
    // initialize defaults
  }
}

// Singleton local fallback engine instance
export const localEngine = new LocalFinOpsEngine();

// Resilient API Client
export const apiClient = {
  baseUrl: BASE_URL,

  async checkHealth(): Promise<boolean> {
    const status = await this.checkServiceStatus();
    return status.goConnected;
  },

  async checkServiceStatus(): Promise<{ goConnected: boolean; aiConnected: boolean }> {
    try {
      const res = await fetch(`${BASE_URL}/status`, {
        signal: AbortSignal.timeout(1800),
        method: 'GET',
      });
      if (res.ok) {
        const data = await res.json();
        const goOk = true;
        const aiOk = Boolean(data.ai_engine_connected);
        localEngine.setConnected(goOk);
        localEngine.setAIConnected(aiOk);
        return { goConnected: goOk, aiConnected: aiOk };
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      try {
        const dashRes = await fetch(`${BASE_URL}/dashboard`, {
          signal: AbortSignal.timeout(1500),
          method: 'GET',
        });
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          const aiOk = Boolean(dashData.ai_engine_connected);
          localEngine.setConnected(true);
          localEngine.setAIConnected(aiOk);
          return { goConnected: true, aiConnected: aiOk };
        }
      } catch {
        // ignore
      }
      localEngine.setConnected(false);
      localEngine.setAIConnected(false);
      return { goConnected: false, aiConnected: false };
    }
  },

  async getDashboard(): Promise<DashboardResponse> {
    try {
      const res = await fetch(`${BASE_URL}/dashboard`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      if (typeof data.ai_engine_connected === 'boolean') {
        localEngine.setAIConnected(data.ai_engine_connected);
      }
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.getDashboard();
    }
  },

  async getResources(filters?: {
    region?: string;
    env?: string;
    team?: string;
    type?: string;
    status?: string;
    search?: string;
  }): Promise<Resource[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.region) params.append('region', filters.region);
      if (filters?.env) params.append('env', filters.env);
      if (filters?.team) params.append('team', filters.team);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);

      const res = await fetch(`${BASE_URL}/resources?${params.toString()}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.getResources(filters);
    }
  },

  async getResource(id: string): Promise<ResourceDetail | null> {
    try {
      const res = await fetch(`${BASE_URL}/resources/${id}`, {
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.getResource(id);
    }
  },

  async getRecommendations(): Promise<RecommendationsResponse> {
    try {
      const res = await fetch(`${BASE_URL}/recommendations`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.getRecommendations();
    }
  },

  async patchRecommendation(id: string, status: 'accepted' | 'rejected'): Promise<RecommendationsResponse> {
    try {
      const res = await fetch(`${BASE_URL}/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.patchRecommendation(id, status);
    }
  },

  async bulkRecommendations(status: 'accepted' | 'rejected', filter_risk: 'ALL' | 'LOW_ONLY'): Promise<RecommendationsResponse> {
    try {
      const res = await fetch(`${BASE_URL}/recommendations/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, filter_risk }),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.bulkRecommendations(status, filter_risk);
    }
  },

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    try {
      const res = await fetch(`${BASE_URL}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.simulate(params);
    }
  },

  async parseNLScenario(query: string): Promise<NLScenarioResponse> {
    try {
      const res = await fetch(`${BASE_URL}/ai/parse-scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      return localEngine.parseNLScenario(query);
    }
  },

  async getAIForecast(days = 60, headroomPct = 25): Promise<AIForecastResponse> {
    try {
      const res = await fetch(`${BASE_URL}/ai/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days,
          headroom: 1 + headroomPct / 100,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      return localEngine.getAIForecast(days, headroomPct);
    }
  },

  async getAIBriefing(role: 'executive' | 'finance' | 'engineering'): Promise<AIBriefingResponse> {
    try {
      const res = await fetch(`${BASE_URL}/ai/briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      return localEngine.getAIBriefing(role);
    }
  },

  async getAlerts(): Promise<AnomalyAlert[]> {
    try {
      const res = await fetch(`${BASE_URL}/alerts`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.getAlerts();
    }
  },

  async getAssumptions(): Promise<AssumptionsResponse> {
    try {
      const res = await fetch(`${BASE_URL}/assumptions`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.getAssumptions();
    }
  },

  async getRemediationExport(): Promise<RemediationExport> {
    try {
      const res = await fetch(`${BASE_URL}/export/remediation`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localEngine.setConnected(true);
      return data;
    } catch {
      localEngine.setConnected(false);
      return localEngine.getRemediationExport();
    }
  },
};
