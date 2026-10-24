import React, { useState, useEffect } from 'react';
import {
  Sliders,
  AlertTriangle,
  ShieldCheck,
  Clock,
  HardDrive,
  Info,
  AlertOctagon,
  Terminal,
  Copy,
  Check,
  ArrowRight,
  Cpu,
} from 'lucide-react';
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
  onSimulate: (params: SimulationParams) => Promise<SimulationResult>;
  onInspectResource?: (id: string) => void;
}

const NL_EXAMPLE_PROMPTS = [
  'What if we shut down all dev VMs in Bangalore from 8 PM to 8 AM and keep 30% peak headroom?',
  'Aggressive rightsizing with 15% peak buffer, weekend staging halt, and purge orphans older than 15 days',
  'Ultra-conservative 40% peak safety buffer for prod SLA protection with standard dev off-hours',
];

export const SimulatorAndAlertsView: React.FC<SimulatorAndAlertsViewProps> = ({
  alerts,
  onSimulate,
  onInspectResource,
}) => {
  const [params, setParams] = useState<SimulationParams>({
    dev_off_hours_enabled: true,
    dev_shutdown_hours_per_week: 118,
    staging_weekend_off_enabled: true,
    safety_headroom_buffer_pct: 25,
    purge_orphaned_older_than_days: 30,
  });

  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [nlQuery, setNlQuery] = useState<string>('');
  const [nlParsing, setNlParsing] = useState<boolean>(false);
  const [nlParsedResult, setNlParsedResult] = useState<NLScenarioResponse | null>(null);
  const [copiedAlertId, setCopiedAlertId] = useState<string | null>(null);

  // Trigger simulation on param changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await onSimulate(params);
        if (!cancelled) setSimResult(res);
      } catch (err) {
        console.error('Simulation run failed:', err);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [params, onSimulate]);

  const handleRunNLScenario = async (queryText?: string) => {
    const targetQuery = (queryText ?? nlQuery).trim();
    if (!targetQuery) return;
    if (queryText) setNlQuery(queryText);

    setNlParsing(true);
    try {
      const parsed = await apiClient.parseNLScenario(targetQuery);
      setNlParsedResult(parsed);
      if (parsed.parsed_params) {
        setParams(parsed.parsed_params);
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

  const handleCopyMitigation = (e: React.MouseEvent, alertId: string, cmd: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cmd);
    setCopiedAlertId(alertId);
    setTimeout(() => setCopiedAlertId(null), 1800);
  };

  const getAlertSeverityBadge = (severity: AnomalyAlert['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="flex items-center space-x-1 rounded-full border border-rose-500/40 bg-rose-950/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-300">
            <AlertOctagon className="h-3 w-3 text-rose-400" />
            <span>CRITICAL</span>
          </span>
        );
      case 'HIGH':
      case 'WARNING':
        return (
          <span className="flex items-center space-x-1 rounded-full border border-amber-500/40 bg-amber-950/40 px-2.5 py-0.5 text-[10px] font-mono font-medium text-amber-300">
            <AlertTriangle className="h-3 w-3 text-amber-400" />
            <span>{severity}</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="flex items-center space-x-1 rounded-full border border-yellow-500/40 bg-yellow-950/40 px-2.5 py-0.5 text-[10px] font-mono font-medium text-yellow-300">
            <Info className="h-3 w-3 text-yellow-400" />
            <span>MEDIUM</span>
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="flex items-center space-x-1 rounded-full border border-cyan-500/30 bg-cyan-950/30 px-2.5 py-0.5 text-[10px] font-mono text-cyan-300">
            <Info className="h-3 w-3 text-cyan-400" />
            <span>INFORMATIONAL</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-800/80 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          "What-If" Scenario Simulator & Capacity Telemetry Alerts
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Model non-linear savings impacts via natural language or slider controls and inspect AI-correlated infrastructure anomalies.
        </p>
      </div>

      {/* Inline Natural-Language "What-If" Command Bar (Python AI :8001) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200 font-mono">
              Natural-Language "What-If" Scenario Parser
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/90">
            POST /api/v1/ai/parse-scenario • Python AI :8001
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunNLScenario();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            placeholder="Try: What if we shut down all dev VMs in Bangalore from 8 PM to 8 AM and keep 30% peak headroom?"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={nlParsing}
            className="flex items-center justify-center space-x-1.5 rounded-md border border-emerald-500/40 bg-emerald-950/50 px-4 py-2 text-xs font-mono font-semibold text-emerald-300 hover:bg-emerald-900/60 transition-colors disabled:opacity-50 shrink-0"
          >
            <span>{nlParsing ? 'Parsing...' : 'Apply Scenario'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

        {/* 1-Click Preset Prompts */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-zinc-500 mr-1">1-Click Prompts:</span>
          {NL_EXAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleRunNLScenario(prompt)}
              className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] font-mono text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors text-left"
            >
              "{prompt}"
            </button>
          ))}
        </div>

        {/* Parsed Intent Feedback Strip */}
        {nlParsedResult && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-950/15 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300 border border-emerald-500/30">
                  {nlParsedResult.provider}
                </span>
                {(nlParsedResult.parsed_tags || []).map((tag, i) => (
                  <span
                    key={i}
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-zinc-400">{nlParsedResult.explanation}</p>
            </div>
            {nlParsedResult.simulation_result && (
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase text-zinc-400 block">Simulated Monthly Yield</span>
                <span className="text-sm font-bold text-emerald-400">
                  +{formatINR(nlParsedResult.simulation_result.simulated_monthly_savings_inr)}/mo
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: What-If Simulator Panel (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Scenario Parameter Controls</h2>
              </div>
              <span className="text-xs font-mono text-zinc-400">POST /api/v1/simulate</span>
            </div>

            {/* Slider 1: Dev Off-Hours Shutdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-zinc-200 flex items-center space-x-2">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Dev Off-Hours Shutdown Window</span>
                </label>
                <span className="font-mono font-bold text-indigo-300">
                  {params.dev_shutdown_hours_per_week} hrs/week ({((params.dev_shutdown_hours_per_week / 168) * 100).toFixed(0)}% idle time)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="168"
                step="2"
                value={params.dev_shutdown_hours_per_week}
                onChange={(e) => {
                  const hrs = Number(e.target.value);
                  setParams({
                    ...params,
                    dev_off_hours_enabled: hrs > 0,
                    dev_shutdown_hours_per_week: hrs,
                  });
                }}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>0 hrs (24/7 Running)</span>
                <span>118 hrs (8PM-8AM Mon-Fri + Full Weekend)</span>
                <span>168 hrs</span>
              </div>
            </div>

            {/* Toggle: Staging Weekend Off */}
            <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 p-3">
              <div>
                <span className="text-xs font-medium text-zinc-200 block">Staging Weekend Scheduled Halt</span>
                <span className="text-[11px] text-zinc-400">
                  Power down staging services from Friday 22:00 to Monday 07:00 IST (57 hrs/week)
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setParams({
                    ...params,
                    staging_weekend_off_enabled: !params.staging_weekend_off_enabled,
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  params.staging_weekend_off_enabled ? 'bg-emerald-600' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    params.staging_weekend_off_enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Slider 3: Safety Headroom Buffer above p95 */}
            <div className="space-y-2 rounded-md border border-cyan-500/20 bg-cyan-950/10 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-cyan-300 flex items-center space-x-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <span>Peak-Safety Headroom Buffer above p95</span>
                </label>
                <span className="font-mono font-bold text-cyan-200">
                  +{params.safety_headroom_buffer_pct}% Buffer
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="5"
                value={params.safety_headroom_buffer_pct}
                onChange={(e) =>
                  setParams({ ...params, safety_headroom_buffer_pct: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-cyan-400/70 font-mono">
                <span>15% (Aggressive)</span>
                <span>25% (Recommended Default)</span>
                <span>50% (Ultra-Conservative)</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 leading-relaxed">
                Raising this slider tightens the threshold (<code>p95 * (1 + buffer) &lt; 70%</code>), actively blocking downsizings on bursty production nodes to guarantee SLA safety.
              </div>
            </div>

            {/* Slider 4: Orphan Purge Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-zinc-200 flex items-center space-x-2">
                  <HardDrive className="h-3.5 w-3.5 text-orange-400" />
                  <span>Orphaned Storage & IP Purge Threshold</span>
                </label>
                <span className="font-mono font-bold text-orange-300">
                  &gt; {params.purge_orphaned_older_than_days} days detached
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="90"
                step="15"
                value={params.purge_orphaned_older_than_days}
                onChange={(e) =>
                  setParams({
                    ...params,
                    purge_orphaned_older_than_days: Number(e.target.value),
                  })
                }
                className="w-full accent-orange-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>15 days</span>
                <span>30 days (Standard)</span>
                <span>90 days</span>
              </div>
            </div>

            {/* Simulation Live Output Box */}
            {simResult && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Live Simulation Projection
                  </span>
                  <span className="font-mono text-xs text-emerald-300">
                    {simResult.simulated_savings_pct}% Net Monthly Reduction
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                    <span className="text-[10px] uppercase text-zinc-400 block">Simulated Spend</span>
                    <span className="text-sm font-bold text-zinc-100">
                      {formatINR(simResult.simulated_monthly_spend_inr)}
                    </span>
                  </div>

                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                    <span className="text-[10px] uppercase text-zinc-400 block">Simulated Savings</span>
                    <span className="text-sm font-bold text-emerald-400">
                      +{formatINR(simResult.simulated_monthly_savings_inr)}
                    </span>
                  </div>

                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                    <span className="text-[10px] uppercase text-zinc-400 block">Eligible VMs</span>
                    <span className="text-sm font-bold text-emerald-300">
                      {simResult.eligible_vms_count} Allowed
                    </span>
                  </div>

                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                    <span className="text-[10px] uppercase text-zinc-400 block">Blocked by Buffer</span>
                    <span className="text-sm font-bold text-cyan-300">
                      🛡️ {simResult.blocked_by_headroom_count} Protected
                    </span>
                  </div>
                </div>

                <div className="text-xs text-zinc-300 font-mono bg-zinc-950 p-2.5 rounded-md border border-zinc-800">
                  Impact Assessment: {simResult.risk_summary}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Capacity & Waste Alerts Feed with Python AI Root-Cause & TTF (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <h2 className="text-sm font-semibold text-zinc-100">
                  AI-Correlated Capacity & Anomaly Alerts
                </h2>
              </div>
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-400 border border-rose-500/30">
                {alerts.length} Detected
              </span>
            </div>

            <div className="space-y-3">
              {alerts.map((alert) => {
                const triggerText = alert.metric_trigger || alert.trigger_metrics || 'Threshold exceeded';
                const resourceId = alert.resource_id || '';
                const resourceName = alert.resource_name || alert.resource_id || 'Infrastructure Resource';

                return (
                  <div
                    key={alert.id}
                    onClick={() => resourceId && onInspectResource?.(resourceId)}
                    className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 hover:border-zinc-700 transition-colors space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getAlertSeverityBadge(alert.severity)}
                        {alert.statistical_z_score !== undefined && alert.statistical_z_score > 0 && (
                          <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                            z={alert.statistical_z_score.toFixed(1)}σ
                          </span>
                        )}
                        {alert.time_to_failure_hours !== undefined && alert.time_to_failure_hours > 0 && (
                          <span className="rounded border border-rose-500/40 bg-rose-950/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-300">
                            TTF: ~{alert.time_to_failure_hours}h
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {alert.id}
                      </span>
                    </div>

                    <h3 className="text-xs font-semibold text-zinc-200">
                      {alert.title}
                    </h3>

                    <div className="font-mono text-[11px] text-zinc-400 bg-zinc-900/80 p-2 rounded-md border border-zinc-800/80 leading-relaxed">
                      <span className="text-zinc-500 block text-[10px] uppercase font-semibold">
                        Telemetry Trigger:
                      </span>
                      {triggerText}
                    </div>

                    {/* Python AI Root-Cause & TTF Formula Correlation */}
                    {(alert.root_cause_correlation || alert.ttf_formula) && (
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-950/10 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-[10px] text-emerald-400">
                          <span className="flex items-center space-x-1 font-semibold uppercase">
                            <Cpu className="h-3 w-3" />
                            <span>AI Root-Cause & Time-to-Failure</span>
                          </span>
                          <span>{alert.ai_provider || 'Python AI :8001'}</span>
                        </div>
                        {alert.root_cause_correlation && (
                          <p className="text-[11px] text-zinc-300 leading-snug">
                            {alert.root_cause_correlation}
                          </p>
                        )}
                        {alert.ttf_formula && (
                          <div className="font-mono text-[10px] text-amber-300 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                            Math: {alert.ttf_formula}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mitigation Command Strip */}
                    {alert.mitigation_command && (
                      <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-[10px] text-zinc-300">
                        <span className="truncate mr-2">$ {alert.mitigation_command}</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyMitigation(e, alert.id, alert.mitigation_command!)}
                          className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 shrink-0"
                        >
                          {copiedAlertId === alert.id ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px]">
                      <span className="font-mono text-zinc-400">
                        Target: <strong className="text-zinc-200">{resourceName}</strong>
                      </span>
                      {alert.financial_impact_inr > 0 ? (
                        <span className="font-mono font-semibold text-rose-400">
                          Burns {formatINR(alert.financial_impact_inr)}/mo
                        </span>
                      ) : (
                        <span className="font-mono text-cyan-400">SLA Protected</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
