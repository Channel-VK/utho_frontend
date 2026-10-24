export type ResourceType =
  | 'vm'
  | 'volume'
  | 'block_volume'
  | 'block_ssd'
  | 'public_ip'
  | 'public_ipv4'
  | string;

export type Environment = 'prod' | 'staging' | 'dev' | string;
export type Region = 'in-noida-1' | 'in-bangalore-1' | 'in-mumbai-1' | string;

export type OptimizationStatus =
  | 'OPTIMAL'
  | 'OVERPROVISIONED'
  | 'PROTECTED_PEAK_LOAD'
  | 'IDLE_SCHEDULE_CANDIDATE'
  | 'ZOMBIE'
  | 'ORPHANED'
  | string;

export type ActionType =
  | 'RIGHTSIZE_VM'
  | 'OFF_HOURS_SHUTDOWN'
  | 'SCHEDULE_OFF_HOURS'
  | 'CLEAN_ORPHANED_VOLUME'
  | 'CLEAN_ORPHANED_IP'
  | 'CLEANUP_ORPHAN'
  | 'TERMINATE_ZOMBIE'
  | 'TERMINATE_ZOMBIE_VM'
  | string;

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | string;

export interface MetricsSummary {
  cpu_avg: number;
  cpu_p50: number;
  cpu_p95: number;
  cpu_p99: number;
  mem_avg: number;
  mem_p50: number;
  mem_p95: number;
  mem_p99: number;
  disk_iops_avg: number;
  disk_iops_p95: number;
  net_mbps_avg: number;
  net_mbps_p95: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  cpu_pct: number;
  mem_pct: number;
  disk_iops: number;
  net_mbps: number;
}

export interface Recommendation {
  id: string;
  resource_id: string;
  resource_name: string;
  resource_type: ResourceType;
  env: Environment;
  region: Region;
  team: string;
  action_type: ActionType;
  action_title?: string;
  current_spec?: string;
  target_spec?: string;
  current_config?: string;
  recommended_config?: string;
  current_monthly_inr: number;
  projected_monthly_inr: number;
  monthly_savings_inr: number;
  formula_string?: string;
  formula_explanation?: string;
  peak_proof?: string;
  reason?: string;
  risk_level: RiskLevel;
  confidence_pct?: number;
  confidence_score?: number;
  status: 'pending' | 'accepted' | 'rejected';
  cli_command?: string;
  terraform_code?: string;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  plan?: string;
  env: Environment;
  region: Region;
  team: string;
  ip_address?: string;
  vcpu?: number;
  ram_gb?: number;
  disk_gb?: number;
  current_spec?: string;
  monthly_cost_inr: number;
  optimization_status: OptimizationStatus;
  status_reason: string;
  metrics_summary: MetricsSummary;
  created_at?: string;
  attached_to?: string;
}

export interface JevAssessment {
  model?: string;
  risk_score?: number;
  risk_score_percentage: number;
  risk_level?: string;
  model_confidence: number | string;
  probabilities?: Record<string, number>;
  probability_distribution?: Record<string, number>;
  explanation?: string;
  decision_policy?: string;
}

export interface QuantileForecastPoint {
  timestamp?: string;
  hour_label: string;
  cpu_q10: number;
  cpu_q50: number;
  cpu_q90: number;
  mem_q10?: number;
  mem_q50: number;
  mem_q90: number;
}

export interface ResourceGreenOps {
  estimated_energy_saved_kwh: number;
  estimated_carbon_saved_kg_co2e: number;
  sustainability_score: number;
  pue: number;
  watts_per_vcpu_range?: string;
}

export interface EngineeringAnalysis {
  resource_id?: string;
  provider?: string;
  peak_safety_explanation?: string;
  naive_vs_safe_comparison?: string;
  cost_formula?: string;
  risk_assessment?: string;
  peak_headroom_proof?: string;
  safety_buffer_analysis?: string;
  technical_explanation?: string;
  blast_radius_analysis?: string;
  workload_classification?: string;
  downsizing_safe?: boolean;
  risk_score?: number;
  confidence_level?: string;
  confidence_reason?: string;
  actionable_next_steps?: string[];
  rollback_runbook?: string[];
  jev_assessment?: JevAssessment;
  quantile_forecast_24h?: QuantileForecastPoint[];
  terraform_hcl?: string;
  greenops_impact?: ResourceGreenOps;
}

export interface ResourceDetail extends Resource {
  timeseries_30d: TimeSeriesPoint[];
  recommendation?: Recommendation;
  engineering_analysis: EngineeringAnalysis;
}

export interface SustainabilityMetric {
  monthly_kwh_saved: number;
  monthly_co2_kg_saved: number;
  trees_equivalent: number;
}

export interface HistoricalSpendPoint {
  month: string;
  spend_inr?: number;
  total_inr?: number;
  compute_inr?: number;
  storage_inr?: number;
  network_inr?: number;
  waste_inr?: number;
  baseline_growth_pct?: number;
}

export interface ForecastPoint {
  date?: string;
  day?: string;
  unoptimized_inr?: number;
  do_nothing_inr?: number;
  optimized_inr: number;
}

export interface SpendByEnv {
  env: string;
  current_inr: number;
  projected_inr: number;
  savings_inr?: number;
}

export interface SpendByRegion {
  region: string;
  current_inr: number;
  projected_inr: number;
  savings_inr?: number;
}

export interface ServiceStatusResponse {
  status: string;
  go_backend: string;
  ai_engine_connected: boolean;
  ai_engine_url: string;
  ai_engine_service: string;
  ai_features: string[];
}

export interface DashboardResponse {
  current_monthly_spend_inr: number;
  projected_monthly_spend_inr: number;
  accepted_monthly_savings_inr: number;
  accepted_savings_pct: number;
  total_potential_savings_inr: number;
  bill_growth_6m_pct: number;
  protected_peak_vms_count: number;
  active_alerts_count: number;
  total_resources_count: number;
  sustainability: SustainabilityMetric;
  historical_spend_6m: HistoricalSpendPoint[];
  forecast_60d: ForecastPoint[];
  spend_by_env: SpendByEnv[];
  spend_by_region: SpendByRegion[];
  ai_engine_connected?: boolean;
  ai_engine_service?: string;
  ai_features?: string[];
}

export interface RecommendationsSummary {
  current_monthly_inr: number;
  projected_monthly_inr: number;
  accepted_savings_inr: number;
  accepted_savings_pct: number;
  accepted_count: number;
  rejected_count: number;
  pending_count: number;
  by_env?: any;
  by_action?: any;
}

export interface RecommendationsResponse {
  summary: RecommendationsSummary;
  items: Recommendation[];
}

export interface SimulationParams {
  dev_off_hours_enabled: boolean;
  dev_shutdown_hours_per_week: number;
  staging_weekend_off_enabled: boolean;
  safety_headroom_buffer_pct: number;
  purge_orphaned_older_than_days: number;
}

export interface SimulationResult {
  simulated_monthly_spend_inr: number;
  simulated_monthly_savings_inr: number;
  simulated_savings_pct: number;
  eligible_vms_count: number;
  blocked_by_headroom_count: number;
  carbon_saved_kg: number;
  risk_summary: string;
  breakdown?: {
    dev_scheduling_savings_inr?: number;
    staging_weekend_savings_inr?: number;
    rightsizing_savings_inr?: number;
    orphan_purge_savings_inr?: number;
  };
}

export interface NLScenarioResponse {
  query: string;
  provider: string;
  parsed_params: SimulationParams;
  detected_scope: {
    environment: string;
    region: string;
    shutdown_start: string;
    shutdown_end: string;
  };
  parsed_tags: string[];
  explanation: string;
  simulation_result: SimulationResult;
}

export interface ComponentCostBreakdown {
  vm_compute: number;
  storage: number;
  public_ip: number;
  total: number;
}

export interface AIForecastResponse {
  days: number;
  currency: string;
  provider: string;
  headroom_factor: number;
  forecast_basis: string;
  current_cost_inr: ComponentCostBreakdown;
  recommended_cost_inr: ComponentCostBreakdown;
  estimated_savings_inr: number;
  savings_pct: number;
  fleet_quantile_summary: {
    cpu_q10_pct: number;
    cpu_q50_pct: number;
    cpu_q90_pct: number;
    mem_q10_pct: number;
    mem_q50_pct: number;
    mem_q90_pct: number;
  };
  sustainability: {
    estimated_energy_saved_kwh: number;
    estimated_carbon_saved_kg_co2e: number;
    sustainability_score: number;
    pue: number;
    grid_carbon_factor_kg_per_kwh: number;
    assumptions: string[];
  };
}

export interface BriefingMetric {
  label: string;
  value: string;
}

export interface AIBriefingResponse {
  role: 'executive' | 'finance' | 'engineering' | string;
  provider: string;
  model: string;
  headline: string;
  summary: string;
  bullet_points: string[];
  key_metrics: BriefingMetric[];
}

export interface AnomalyAlert {
  id: string;
  resource_id?: string;
  resource_name?: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'MEDIUM' | 'INFO' | string;
  title: string;
  metric_trigger?: string;
  trigger_metrics?: string;
  why_raised: string;
  financial_impact_inr: number;
  detected_at: string;
  recommended_action?: string;
  remediation_hint?: string;
  region?: string;
  env?: string;
  ai_provider?: string;
  root_cause_correlation?: string;
  time_to_failure_hours?: number;
  ttf_formula?: string;
  slope_pct_per_day?: number;
  statistical_z_score?: number;
  blast_radius?: string;
  mitigation_command?: string;
}

export interface PricingPlan {
  plan: string;
  vcpu: number;
  ram_gb: number;
  hourly_inr: number;
  monthly_inr: number;
  target_workload: string;
}

export interface FormulaAssumption {
  name: string;
  category: string;
  formula_math: string;
  explanation: string;
  variables: Record<string, string>;
}

export interface AssumptionsResponse {
  pricing_catalog: any;
  formulas?: FormulaAssumption[];
  safety_formulas?: Record<string, string>;
  off_hours_schedule_math?: any;
  grid_carbon_factor_kg_co2_per_kwh?: number;
}

export interface RemediationExport {
  utho_cli_script: string;
  terraform_hcl: string;
  csv_report: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  conversation_id: string;
  answer: string;
  tool?: string;
  data?: any;
  model?: string;
}

export interface ChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  tool?: string;
  data?: any;
}

export interface ChatHistoryResponse {
  conversation_id: string;
  created_at: string;
  updated_at: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }[];
}
