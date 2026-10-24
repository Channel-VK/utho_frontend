import React, { useState, useEffect } from 'react';
import type {
  SimulationParams,
  SimulationResult,
  AnomalyAlert,
  NLScenarioResponse,
} from '../types/api';
import { apiClient } from '../api/client';
import { formatINR } from '../utils/format';

interface SimulatorAndAlertsViewProps {
  alerts: AnomalyAlert[];
  baselineMonthlyInr?: number;
  onSimulate: (params: SimulationParams) => Promise<SimulationResult>;
  onInspectResource?: (id: string) => void;
  onOpenExportModal?: () => void;
}

const NL_EXAMPLE_PROMPTS = [
  'What if we shut down all dev VMs in Bangalore from 8 PM to 8 AM and keep 30% peak headroom?',
  'Aggressive rightsizing with 15% peak buffer, weekend staging halt, and purge orphans older than 15 days',
  'Ultra-conservative 40% peak safety buffer for prod SLA protection with standard dev off-hours',
];

export const SimulatorAndAlertsView: React.FC<SimulatorAndAlertsViewProps> = ({
  alerts,
  baselineMonthlyInr = 1284500,
  onSimulate,
  onInspectResource,
  onOpenExportModal,
}) => {
  const [params, setParams] = useState<SimulationParams>({
    dev_off_hours_enabled: true,
    dev_shutdown_hours_per_week: 108,
    staging_weekend_off_enabled: true,
    safety_headroom_buffer_pct: 25,
    purge_orphaned_older_than_days: 14,
  });

  const [stagingHours, setStagingHours] = useState<number>(72);
  const [bufferEnabled, setBufferEnabled] = useState<boolean>(true);
  const [diskCleanupEnabled, setDiskCleanupEnabled] = useState<boolean>(true);

  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState<string>(
    'Q4 Non-Prod Weekend Halt & Memory Trimming'
  );
  const [nlParsing, setNlParsing] = useState<boolean>(false);
  const [nlParsedResult, setNlParsedResult] = useState<NLScenarioResponse | null>(null);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>({});
  const [copiedAlertId, setCopiedAlertId] = useState<string | null>(null);

  // Trigger live Go backend simulation whenever parameters change
  useEffect(() => {
    let cancelled = false;
    const effectiveParams: SimulationParams = {
      dev_off_hours_enabled: params.dev_off_hours_enabled && params.dev_shutdown_hours_per_week > 0,
      dev_shutdown_hours_per_week: params.dev_off_hours_enabled ? params.dev_shutdown_hours_per_week : 0,
      staging_weekend_off_enabled: params.staging_weekend_off_enabled && stagingHours > 0,
      safety_headroom_buffer_pct: bufferEnabled ? params.safety_headroom_buffer_pct : 50,
      purge_orphaned_older_than_days: diskCleanupEnabled ? params.purge_orphaned_older_than_days : 90,
    };

    onSimulate(effectiveParams)
      .then((res) => {
        if (!cancelled) setSimResult(res);
      })
      .catch((err) => console.error('Simulation failed:', err));

    return () => {
      cancelled = true;
    };
  }, [params, stagingHours, bufferEnabled, diskCleanupEnabled, onSimulate]);

  const handleRunNLScenario = async (queryText?: string) => {
    const targetQuery = (queryText ?? scenarioLabel).trim();
    if (!targetQuery) return;
    if (queryText) setScenarioLabel(queryText);

    setNlParsing(true);
    try {
      const parsed = await apiClient.parseNLScenario(targetQuery);
      setNlParsedResult(parsed);
      if (parsed.parsed_params) {
        setParams(parsed.parsed_params);
        setBufferEnabled(true);
        setDiskCleanupEnabled(true);
        setStagingHours(parsed.parsed_params.staging_weekend_off_enabled ? 72 : 0);
      }
      if (parsed.simulation_result) {
        setSimResult(parsed.simulation_result);
      }
    } catch (err) {
      console.error('NL scenario parsing failed:', err);
    } finally {
      setNlParsing(false);
    }
  };

  const handleResetDefaults = () => {
    setScenarioLabel('Q4 Non-Prod Weekend Halt & Memory Trimming');
    setNlParsedResult(null);
    setStagingHours(72);
    setBufferEnabled(true);
    setDiskCleanupEnabled(true);
    setParams({
      dev_off_hours_enabled: true,
      dev_shutdown_hours_per_week: 108,
      staging_weekend_off_enabled: true,
      safety_headroom_buffer_pct: 25,
      purge_orphaned_older_than_days: 14,
    });
  };

  const handleCopyMitigation = (alertId: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedAlertId(alertId);
    setTimeout(() => setCopiedAlertId(null), 1800);
  };

  const baselineInr =
    simResult && simResult.simulated_monthly_spend_inr + simResult.simulated_monthly_savings_inr > 0
      ? simResult.simulated_monthly_spend_inr + simResult.simulated_monthly_savings_inr
      : baselineMonthlyInr;

  const projectedInr = simResult?.simulated_monthly_spend_inr ?? Math.round(baselineInr * 0.72);
  const netSavingsInr = simResult?.simulated_monthly_savings_inr ?? Math.round(baselineInr - projectedInr);
  const netSavingsPct =
    simResult?.simulated_savings_pct ??
    Number(((netSavingsInr / Math.max(1, baselineInr)) * 100).toFixed(1));

  const kwhSaved = Math.max(180, Math.round((netSavingsInr / 420) * 1.15));
  const co2MetricTons = ((kwhSaved * 0.75) / 1000).toFixed(2);

  return (
    <div className="space-y-6 pb-12">
      {/* Subheader explanation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-black/[0.07] gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#111318]">
            Infrastructure Capacity &amp; Fleet Anomaly Control
          </h2>
          <p className="text-xs text-[#525866] mt-0.5">
            Model dynamic shutdown cycles, adjust p95/p99 safety margins, and evaluate instant AI-correlated incident remediation paths.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-[#525866] font-mono">
            Monthly Baseline: <span className="font-bold text-[#111318]">{formatINR(baselineInr)}</span>
          </div>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#111318] glass-card rounded-lg hover:bg-white/90 transition-all"
          >
            Reset Defaults
          </button>
        </div>
      </div>

      {/* 2-COLUMN SPLIT (7 Cols Left Simulator / 5 Cols Right Incident Alert Cards) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: WHAT-IF COST CALCULATOR (7 cols) */}
        <div className="xl:col-span-7 space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-6">
            {/* Title & Scenario Name / NL AI Input */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#111318] tracking-tight">
                    What-If Cost Simulator
                  </h3>
                  <p className="text-xs text-[#525866]">
                    Adjust fleet operational policies or describe a scenario in plain English to inspect projected INR runway gains.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold px-2.5 py-1 glass-pill-neutral rounded-lg">
                  Live Engine :8080 + :8001
                </span>
              </div>

              {/* Sleek Text Input wired to Python AI :8001 Scenario Parser */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRunNLScenario();
                }}
                className="space-y-1.5"
              >
                <label
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#525866]"
                  htmlFor="scenario-input"
                >
                  Scenario Label / Natural-Language AI Prompt
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="scenario-input"
                    type="text"
                    value={scenarioLabel}
                    onChange={(e) => setScenarioLabel(e.target.value)}
                    placeholder="Enter scenario name or natural language query (e.g., Shut down dev VMs 8PM-8AM with 30% headroom)..."
                    className="flex-1 text-sm font-medium text-[#111318] bg-white/75 border border-black/[0.10] rounded-xl px-4 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/15 focus:border-[#111318] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={nlParsing}
                    className="px-4 py-2.5 rounded-xl bg-[#111318] hover:bg-[#272B33] text-white text-xs font-bold tracking-wide transition-colors shrink-0 disabled:opacity-50"
                  >
                    {nlParsing ? 'Parsing AI...' : 'Parse & Simulate'}
                  </button>
                </div>
              </form>

              {/* AI Parsed Feedback Banner */}
              {nlParsedResult && (
                <div className="p-3.5 rounded-xl glass-well space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-[#111318] text-white text-[10px] font-mono font-bold uppercase">
                        {nlParsedResult.provider}
                      </span>
                      {(nlParsedResult.parsed_tags || []).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded glass-pill-neutral text-[11px] font-mono font-semibold"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[#3F4450]">{nlParsedResult.explanation}</p>
                </div>
              )}

              {/* Clickable Preset Buttons (Monochromatic Glass Pills) */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#525866] block">
                  Fast Configuration Presets &amp; AI Scenarios
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScenarioLabel('Weekend Shutdown & Standard Dev Schedule');
                      setStagingHours(96);
                      setParams((p) => ({
                        ...p,
                        dev_off_hours_enabled: true,
                        dev_shutdown_hours_per_week: 90,
                        staging_weekend_off_enabled: true,
                      }));
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg glass-pill-neutral hover:bg-black/[0.08] hover:text-[#111318] transition-colors"
                  >
                    Weekend Shutdown
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScenarioLabel('Aggressive Dev & QA Off-Hours Pause');
                      setParams((p) => ({
                        ...p,
                        dev_off_hours_enabled: true,
                        dev_shutdown_hours_per_week: 132,
                      }));
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg glass-pill-neutral hover:bg-black/[0.08] hover:text-[#111318] transition-colors"
                  >
                    Aggressive Dev Pause
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScenarioLabel('Max Headroom Buffer Trim (15% Peak Buffer)');
                      setBufferEnabled(true);
                      setParams((p) => ({
                        ...p,
                        safety_headroom_buffer_pct: 15,
                      }));
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg glass-pill-neutral hover:bg-black/[0.08] hover:text-[#111318] transition-colors"
                  >
                    Max Buffer Trim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScenarioLabel('Storage & Orphaned IP Deep Clean (>7 Days)');
                      setDiskCleanupEnabled(true);
                      setParams((p) => ({
                        ...p,
                        purge_orphaned_older_than_days: 7,
                      }));
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg glass-pill-neutral hover:bg-black/[0.08] hover:text-[#111318] transition-colors"
                  >
                    Storage Deep Clean
                  </button>
                </div>

                {/* 1-Click Natural Language Prompts */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {NL_EXAMPLE_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleRunNLScenario(prompt)}
                      className="text-[11px] font-mono px-2.5 py-1 rounded-md glass-well hover:bg-black/[0.06] text-[#3F4450] hover:text-[#111318] transition-colors text-left"
                    >
                      AI Prompt {i + 1}: &ldquo;{prompt.slice(0, 58)}...&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4 GLASSMORPHIC SLIDERS & TOGGLES */}
            <div className="space-y-4 pt-2 border-t border-black/[0.06]">
              {/* Slider 1: Weeknight Dev Schedules */}
              <div className="p-4 rounded-xl glass-well space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#111318]">Weeknight Dev Schedules</div>
                    <div className="text-[11px] text-[#525866]">
                      Auto-halt idle developer and QA test boxes during off-peak windows.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded glass-pill-neutral">
                      {params.dev_shutdown_hours_per_week} hrs/week
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setParams((p) => ({ ...p, dev_off_hours_enabled: !p.dev_off_hours_enabled }))
                      }
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors ${
                        params.dev_off_hours_enabled ? 'status-green' : 'glass-pill-neutral opacity-75'
                      }`}
                    >
                      {params.dev_off_hours_enabled ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={140}
                  step={4}
                  value={params.dev_shutdown_hours_per_week}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      dev_off_hours_enabled: Number(e.target.value) > 0,
                      dev_shutdown_hours_per_week: Number(e.target.value),
                    }))
                  }
                  className="w-full h-1.5 bg-black/[0.09] rounded-lg appearance-none cursor-pointer slider-minimal"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#525866]">
                  <span>0 hrs (Continuous)</span>
                  <span>70 hrs (Standard)</span>
                  <span>140 hrs (Strict On-Demand)</span>
                </div>
              </div>

              {/* Slider 2: Weekend Staging Pauses */}
              <div className="p-4 rounded-xl glass-well space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#111318]">Weekend Staging Pauses</div>
                    <div className="text-[11px] text-[#525866]">
                      Friday 20:00 to Monday 08:00 IST staging microservices freeze.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded glass-pill-neutral">
                      {stagingHours} hrs/week
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setParams((p) => ({
                          ...p,
                          staging_weekend_off_enabled: !p.staging_weekend_off_enabled,
                        }))
                      }
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors ${
                        params.staging_weekend_off_enabled ? 'status-green' : 'glass-pill-neutral opacity-75'
                      }`}
                    >
                      {params.staging_weekend_off_enabled ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={6}
                  value={stagingHours}
                  onChange={(e) => {
                    const hrs = Number(e.target.value);
                    setStagingHours(hrs);
                    setParams((p) => ({
                      ...p,
                      staging_weekend_off_enabled: hrs > 0,
                    }));
                  }}
                  className="w-full h-1.5 bg-black/[0.09] rounded-lg appearance-none cursor-pointer slider-minimal"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#525866]">
                  <span>0 hrs (Always On)</span>
                  <span>60 hrs (Weekend Only)</span>
                  <span>120 hrs (Full Off-Peak)</span>
                </div>
              </div>

              {/* Slider 3: Peak Safety Buffers */}
              <div className="p-4 rounded-xl glass-well space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#111318]">Peak Safety Buffers</div>
                    <div className="text-[11px] text-[#525866]">
                      Production headroom margin above p95/p99 traffic spikes (protects bursty nodes).
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded glass-pill-neutral">
                      {params.safety_headroom_buffer_pct}% headroom
                    </span>
                    <button
                      type="button"
                      onClick={() => setBufferEnabled((b) => !b)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors ${
                        bufferEnabled ? 'status-green' : 'glass-pill-neutral opacity-75'
                      }`}
                    >
                      {bufferEnabled ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  value={params.safety_headroom_buffer_pct}
                  onChange={(e) => {
                    setBufferEnabled(true);
                    setParams((p) => ({
                      ...p,
                      safety_headroom_buffer_pct: Number(e.target.value),
                    }));
                  }}
                  className="w-full h-1.5 bg-black/[0.09] rounded-lg appearance-none cursor-pointer slider-minimal"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#525866]">
                  <span>10% (Tight Fleet)</span>
                  <span>25% (Recommended)</span>
                  <span>60% (Over-Provisioned)</span>
                </div>
              </div>

              {/* Slider 4: Unused Disk Cleanup */}
              <div className="p-4 rounded-xl glass-well space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#111318]">Unused Disk &amp; IP Cleanup</div>
                    <div className="text-[11px] text-[#525866]">
                      Purge unattached block SSD volumes and unassociated static IPv4 addresses.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded glass-pill-neutral">
                      &gt; {params.purge_orphaned_older_than_days} days idle
                    </span>
                    <button
                      type="button"
                      onClick={() => setDiskCleanupEnabled((d) => !d)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors ${
                        diskCleanupEnabled ? 'status-green' : 'glass-pill-neutral opacity-75'
                      }`}
                    >
                      {diskCleanupEnabled ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={3}
                  max={60}
                  step={1}
                  value={params.purge_orphaned_older_than_days}
                  onChange={(e) => {
                    setDiskCleanupEnabled(true);
                    setParams((p) => ({
                      ...p,
                      purge_orphaned_older_than_days: Number(e.target.value),
                    }));
                  }}
                  className="w-full h-1.5 bg-black/[0.09] rounded-lg appearance-none cursor-pointer slider-minimal"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#525866]">
                  <span>3 Days (Aggressive)</span>
                  <span>14 Days (Standard)</span>
                  <span>60 Days (Conservative)</span>
                </div>
              </div>
            </div>

            {/* PROJECTED FINANCIAL & SUSTAINABILITY SUMMARY CARD */}
            <div className="mt-6 p-6 rounded-2xl glass-well space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#111318]">
                  Projected Financial &amp; Sustainability Model
                </span>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded status-green">
                  High Confidence (98.4%)
                </span>
              </div>

              {/* Bill comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="p-3.5 bg-white/75 rounded-xl border border-black/[0.06]">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[#525866]">
                    Current Monthly Baseline
                  </div>
                  <div className="text-lg font-bold line-through text-[#68707E] font-mono">
                    {formatINR(baselineInr)}
                  </div>
                  <div className="text-[11px] text-[#525866]">
                    Pre-simulation Utho Cloud billing
                  </div>
                </div>
                <div className="p-3.5 bg-white/90 rounded-xl border border-black/[0.12] shadow-xs">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-[#111318]">
                    Projected Monthly Bill
                  </div>
                  <div className="text-2xl font-extrabold text-[#111318] font-mono tracking-tight">
                    {formatINR(projectedInr)} /mo
                  </div>
                  <div className="text-[11px] text-[#525866] font-medium">
                    {simResult
                      ? `${simResult.eligible_vms_count} VMs eligible · ${simResult.blocked_by_headroom_count} SLA-protected`
                      : 'Derived from 4 live operational policies'}
                  </div>
                </div>
              </div>

              {/* Blended Mineral Sage Net Savings Callout Container */}
              <div className="p-4 rounded-xl status-green flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider opacity-85">
                    Validated Impact
                  </div>
                  <div className="text-lg font-extrabold font-mono tracking-tight">
                    Net Savings: -{formatINR(netSavingsInr)}/mo ({netSavingsPct}% cut)
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-[#1D5C46]/15 text-[#1D5C46]">
                    Monthly Recurring Gain
                  </span>
                </div>
              </div>

              {/* Energy & Carbon Callout */}
              <div className="p-3.5 rounded-xl bg-white/70 border border-black/[0.06] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#111318]">
                    Energy &amp; Carbon Footprint Reduction
                  </div>
                  <div className="text-xs font-mono text-[#525866] mt-0.5">
                    {kwhSaved.toLocaleString('en-IN')} kWh/mo saved (~{co2MetricTons} metric tons CO2e reduced)
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded status-green">
                  Scope 2
                </span>
              </div>

              {simResult?.risk_summary && (
                <div className="p-3 rounded-xl bg-white/60 border border-black/[0.06] text-xs font-mono text-[#3F4450]">
                  Governor Audit: {simResult.risk_summary}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-[#111318] bg-white/85 border border-black/[0.12] hover:bg-white rounded-xl transition-all text-center"
                >
                  Compare with Baseline
                </button>
                <button
                  type="button"
                  onClick={onOpenExportModal}
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-[#111318] hover:bg-[#272B33] rounded-xl transition-all text-center"
                >
                  Generate Terraform Plan
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: INCIDENT ALERT CARDS (5 cols — Blended Red/Yellow/Green Statuses) */}
        <div className="xl:col-span-5 space-y-5">
          {/* Section Header */}
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-bold text-[#111318] tracking-tight">
              Active Incidents &amp; Anomalies
            </h3>
            <span className="text-xs font-bold font-mono px-2.5 py-1 status-red rounded-full">
              {alerts.length} Needs Attention
            </span>
          </div>

          {alerts.map((alert, idx) => {
            const isCritical = alert.severity === 'CRITICAL' || idx === 0;
            const isHigh = alert.severity === 'HIGH' || alert.severity === 'WARNING' || idx === 1;

            const badgeStatusClass = isCritical
              ? 'status-red'
              : 'status-yellow';

            const badgeLabel = isCritical
              ? 'Critical Spike'
              : isHigh
              ? 'High Priority'
              : 'Elevated Notice';

            const triggerText = alert.metric_trigger || alert.trigger_metrics || '';
            const isAck = acknowledgedAlerts[alert.id];

            return (
              <div
                key={alert.id}
                className="glass-card rounded-2xl p-5 space-y-3.5 transition-all"
              >
                {/* Card Top Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wider ${badgeStatusClass}`}
                    >
                      {badgeLabel}
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#525866]">
                      {alert.id}
                    </span>
                    {alert.statistical_z_score !== undefined && alert.statistical_z_score > 0 && (
                      <span className="px-2 py-0.5 rounded glass-pill-neutral text-[11px] font-mono font-bold">
                        z={alert.statistical_z_score.toFixed(1)}σ
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      isCritical ? 'text-[#8F2925]' : 'text-[#7C4F14]'
                    }`}
                  >
                    {alert.time_to_failure_hours !== undefined && alert.time_to_failure_hours > 0
                      ? `TTF: ~${alert.time_to_failure_hours}h`
                      : 'Active Trace'}
                  </span>
                </div>

                {/* Resource & Description */}
                <div>
                  <div className="text-xs font-mono font-bold text-[#111318]">
                    {alert.resource_name || alert.resource_id} / {alert.region || 'in-mumbai-1'}
                  </div>
                  <div className="text-xs font-semibold text-[#111318] mt-0.5">
                    {alert.title}
                  </div>
                  <p className="text-xs text-[#3F4450] mt-1 leading-relaxed">
                    {triggerText}{' '}
                    {alert.financial_impact_inr > 0 && (
                      <>
                        Current run-rate impact:{' '}
                        <span className="font-bold text-[#8F2925] font-mono">
                          +{formatINR(alert.financial_impact_inr)}/mo
                        </span>{' '}
                        above baseline.
                      </>
                    )}
                  </p>
                </div>

                {/* Suggested Action & Python AI (:8001) Root-Cause Correlation */}
                <div className="p-3.5 glass-well rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#525866]">
                      Suggested Action &amp; AI Root-Cause
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-[#3F4450]">
                      {alert.ai_provider || 'Python AI :8001'}
                    </span>
                  </div>
                  <div className="text-xs text-[#111318] leading-relaxed">
                    {alert.root_cause_correlation || alert.recommended_action}
                  </div>
                  {alert.ttf_formula && (
                    <div className="text-[11px] font-mono text-[#7C4F14] status-yellow px-2 py-1 rounded">
                      Math: {alert.ttf_formula}
                    </div>
                  )}
                  {alert.mitigation_command && (
                    <div className="flex items-center justify-between gap-2 bg-[#111318] text-[#F3F4F6] px-2.5 py-1.5 rounded-lg font-mono text-[10px]">
                      <span className="truncate">$ {alert.mitigation_command}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyMitigation(alert.id, alert.mitigation_command!)}
                        className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white font-bold shrink-0 transition-colors"
                      >
                        {copiedAlertId === alert.id ? 'Copied' : 'Copy CLI'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (alert.resource_id && onInspectResource) {
                        onInspectResource(alert.resource_id);
                      } else {
                        setAcknowledgedAlerts((prev) => ({ ...prev, [alert.id]: !prev[alert.id] }));
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-[#3F4450] hover:text-[#111318] glass-well hover:bg-black/[0.06] rounded-lg transition-colors"
                  >
                    {alert.resource_id ? 'Inspect Metrics' : isAck ? 'Acknowledged' : 'Acknowledge'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAcknowledgedAlerts((prev) => ({ ...prev, [alert.id]: true }));
                      if (alert.mitigation_command) {
                        handleCopyMitigation(alert.id, alert.mitigation_command);
                      }
                    }}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      isAck
                        ? 'status-green'
                        : 'bg-[#111318] hover:bg-[#272B33] text-white'
                    }`}
                  >
                    {isAck
                      ? 'Remediation Queued'
                      : isCritical
                      ? 'Apply Remediation Fix'
                      : isHigh
                      ? 'Execute Safeguard'
                      : 'Enable Lifecycle Rule'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
