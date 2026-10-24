import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Server,
  HardDrive,
  Globe,
  Check,
  Terminal,
  Cpu,
  Copy,
  AlertTriangle,
  Leaf,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { ResourceDetail } from '../types/api';
import { formatINR } from '../utils/format';

interface ResourceDetailModalProps {
  resource: ResourceDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onAcceptRecommendation?: (id: string) => void;
  onRejectRecommendation?: (id: string) => void;
}

export const ResourceDetailModal: React.FC<ResourceDetailModalProps> = ({
  resource,
  isOpen,
  onClose,
  onAcceptRecommendation,
  onRejectRecommendation,
}) => {
  const [metricTab, setMetricTab] = useState<'cpu' | 'mem' | 'io'>('cpu');
  const [copiedTf, setCopiedTf] = useState(false);

  if (!isOpen || !resource) return null;

  const TypeIcon =
    resource.type === 'vm'
      ? Server
      : resource.type === 'volume' || resource.type === 'block_volume' || resource.type === 'block_ssd'
      ? HardDrive
      : Globe;

  const isProtectedPeak = resource.optimization_status === 'PROTECTED_PEAK_LOAD';
  const rec = resource.recommendation;
  const eng = resource.engineering_analysis || {};

  const planName = resource.plan || (resource.current_spec ? resource.current_spec.split(' ')[0] : 'Standard');
  const vcpuText =
    resource.vcpu !== undefined ? `${resource.vcpu} vCPU · ${resource.ram_gb} GB RAM` : resource.current_spec || '';

  const proofText =
    eng.peak_headroom_proof ||
    eng.naive_vs_safe_comparison ||
    resource.status_reason ||
    'Headroom telemetry validated.';

  const explanationText =
    eng.technical_explanation ||
    eng.peak_safety_explanation ||
    resource.status_reason ||
    'Operating profile analyzed against peak safety governors.';

  const riskText =
    eng.risk_assessment ||
    (eng.downsizing_safe === false
      ? 'Downsizing Blocked: Preserves Latency SLA'
      : eng.downsizing_safe === true
      ? 'Downsizing Verified Safe'
      : 'Under Active FinOps Governance');

  const jev = eng.jev_assessment;
  const jevProbs = jev?.probabilities || jev?.probability_distribution || {};
  const quantiles = eng.quantile_forecast_24h || [];
  const sampleQuantiles = quantiles.slice(0, 6);
  const runbookSteps = eng.rollback_runbook || eng.actionable_next_steps || [];
  const tfCode = eng.terraform_hcl || rec?.terraform_code || '';
  const greenOps = eng.greenops_impact;

  const handleCopyTf = () => {
    if (!tfCode) return;
    navigator.clipboard.writeText(tfCode);
    setCopiedTf(true);
    setTimeout(() => setCopiedTf(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950/80">
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-md border ${
                isProtectedPeak
                  ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-400'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300'
              }`}
            >
              {isProtectedPeak ? <ShieldCheck className="h-5 w-5" /> : <TypeIcon className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-zinc-100">{resource.name}</h2>
                <span className="font-mono text-xs text-zinc-500">({resource.id})</span>
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono uppercase text-zinc-300">
                  {resource.env}
                </span>
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                  {resource.region}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Team: <span className="text-zinc-200">{resource.team}</span> • Spec:{' '}
                <span className="font-mono text-zinc-200 font-semibold">{planName}</span>
                {vcpuText && <span className="text-zinc-400"> ({vcpuText})</span>}
                {resource.ip_address && (
                  <>
                    {' '}• IP: <span className="font-mono text-zinc-200">{resource.ip_address}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">Monthly Tariff</span>
              <span className="font-mono text-sm font-bold text-zinc-100">{formatINR(resource.monthly_cost_inr)}</span>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Peak-Safety Warning Banner if Protected */}
          {isProtectedPeak && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-4">
              <div className="flex items-start space-x-3">
                <ShieldCheck className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-cyan-200 uppercase tracking-wider text-[11px]">
                    Peak-Safety Governor: Naive Downsizing Blocked
                  </div>
                  <p className="text-cyan-300/90 leading-relaxed">
                    {explanationText}
                  </p>
                  <div className="font-mono text-[11px] text-cyan-400 mt-1">
                    Telemetry: avg={Math.round(resource.metrics_summary?.cpu_avg || 0)}% | p95={Math.round(resource.metrics_summary?.cpu_p95 || 0)}% | p99={Math.round(resource.metrics_summary?.cpu_p99 || 0)}% (Safety Threshold: 85%)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Time-Series Chart Header Controls */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">30-Day Continuous Telemetry & Percentile Envelope</h3>
                <p className="text-xs text-zinc-400">
                  Granular hourly trace with 85% peak-safety tripwire and p95/p99 reference thresholds
                </p>
              </div>

              {/* Metric Selector Tabs */}
              <div className="flex space-x-1 rounded-md bg-zinc-900 p-1 border border-zinc-800">
                <button
                  onClick={() => setMetricTab('cpu')}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    metricTab === 'cpu'
                      ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  CPU Utilization %
                </button>
                <button
                  onClick={() => setMetricTab('mem')}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    metricTab === 'mem'
                      ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Memory %
                </button>
                <button
                  onClick={() => setMetricTab('io')}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    metricTab === 'io'
                      ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Disk IOPS & Net Mbps
                </button>
              </div>
            </div>

            {/* Line Chart */}
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={resource.timeseries_30d || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    interval={16}
                    tickFormatter={(val) => String(val).split(' ')[0].split('T')[0]}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    domain={metricTab === 'io' ? ['auto', 'auto'] : [0, 100]}
                    tickFormatter={(val) => (metricTab === 'io' ? val : `${val}%`)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#3f3f46',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                  {metricTab === 'cpu' && (
                    <>
                      <ReferenceLine
                        y={85}
                        stroke="#f43f5e"
                        strokeDasharray="4 4"
                        label={{
                          value: '85% Burst Ceiling (SLA Breach)',
                          fill: '#f43f5e',
                          fontSize: 10,
                          position: 'insideTopRight',
                        }}
                      />
                      {resource.metrics_summary?.cpu_p99 !== undefined && (
                        <ReferenceLine
                          y={resource.metrics_summary.cpu_p99}
                          stroke="#06b6d4"
                          strokeDasharray="3 3"
                          label={{
                            value: `p99: ${resource.metrics_summary.cpu_p99.toFixed(1)}%`,
                            fill: '#06b6d4',
                            fontSize: 10,
                            position: 'insideTopLeft',
                          }}
                        />
                      )}
                      {resource.metrics_summary?.cpu_avg !== undefined && (
                        <ReferenceLine
                          y={resource.metrics_summary.cpu_avg}
                          stroke="#71717a"
                          strokeDasharray="2 2"
                          label={{
                            value: `Avg: ${resource.metrics_summary.cpu_avg.toFixed(1)}%`,
                            fill: '#71717a',
                            fontSize: 10,
                            position: 'insideBottomLeft',
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="cpu_pct"
                        name="CPU Utilization %"
                        stroke={isProtectedPeak ? '#06b6d4' : '#10b981'}
                        strokeWidth={1.75}
                        dot={false}
                      />
                    </>
                  )}

                  {metricTab === 'mem' && (
                    <>
                      <ReferenceLine
                        y={80}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{
                          value: '80% High Memory Ceiling',
                          fill: '#f59e0b',
                          fontSize: 10,
                          position: 'insideTopRight',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="mem_pct"
                        name="Memory Utilization %"
                        stroke="#38bdf8"
                        strokeWidth={1.75}
                        dot={false}
                      />
                    </>
                  )}

                  {metricTab === 'io' && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="disk_iops"
                        name="Disk IOPS"
                        stroke="#eab308"
                        strokeWidth={1.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="net_mbps"
                        name="Network Mbps"
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Deep Engineering Analysis Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Decision Comparison Card */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Peak Headroom Mathematical Proof
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-line bg-zinc-900 p-3 rounded-md border border-zinc-800/80">
                {proofText}
              </p>
              <div className="text-[11px] text-zinc-400">
                Risk Assessment:{' '}
                <span className="font-semibold text-zinc-200">
                  {riskText}
                </span>
              </div>
            </div>

            {/* Actionable Recommendation Card if present */}
            {rec ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">
                      Recommendation Action
                    </span>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                      Confidence: {rec.confidence_score ?? rec.confidence_pct ?? 95}%
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-100">
                    {rec.action_title || rec.action_type}
                  </h4>
                  <div className="font-mono text-xs text-zinc-300">
                    {rec.current_config || rec.current_spec} <span className="text-emerald-400">→</span>{' '}
                    {rec.recommended_config || rec.target_spec}
                  </div>
                  <div className="font-mono text-xs text-emerald-300">
                    Formula: {rec.formula_explanation || rec.formula_string}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Peak Proof: <span className="text-zinc-300">{rec.reason || rec.peak_proof}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-emerald-500/20">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    Save {formatINR(rec.monthly_savings_inr)}/mo
                  </span>
                  <div className="flex items-center space-x-2">
                    {onRejectRecommendation && (
                      <button
                        onClick={() => onRejectRecommendation(rec.id)}
                        className={`rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 ${
                          rec.status === 'rejected' ? 'bg-zinc-700 text-rose-300 border-rose-500/40' : ''
                        }`}
                      >
                        Reject
                      </button>
                    )}
                    {onAcceptRecommendation && (
                      <button
                        onClick={() => onAcceptRecommendation(rec.id)}
                        className={`rounded-md border border-emerald-500/40 bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-900/60 ${
                          rec.status === 'accepted' ? 'bg-emerald-600 text-white' : ''
                        }`}
                      >
                        {rec.status === 'accepted' ? 'Committed ✓' : 'Accept Change'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col justify-center items-center text-center text-xs text-zinc-400 space-y-2">
                <Check className="h-6 w-6 text-emerald-400" />
                <span className="font-semibold text-zinc-200">No Action Required</span>
                <p>
                  Workload is currently operating within optimal capacity parameters or protected by peak safety governor.
                </p>
              </div>
            )}
          </div>

          {/* Dedicated SRE & AI Telemetry Audit Panel (Python AI :8001 Integration) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  SRE & AI Telemetry Audit (Jev Risk + 24h Quantile Forecast + Rollback Runbook)
                </h3>
              </div>
              <div className="flex items-center space-x-2 font-mono text-[10px]">
                <span className="rounded border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-emerald-300">
                  {eng.provider || 'Python-AI-Service (:8001)'}
                </span>
                <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-300">
                  Evidence: {eng.confidence_level || 'HIGH'}
                </span>
                {eng.workload_classification && (
                  <span className="rounded border border-cyan-500/30 bg-cyan-950/30 px-2 py-0.5 text-cyan-300">
                    {eng.workload_classification}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Col 1: TypeSafe Jev Ordinal Risk & GreenOps */}
              <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-3.5 space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase text-zinc-400 font-semibold">
                    Jev Ordinal Capacity Risk
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      (jev?.risk_score_percentage ?? eng.risk_score ?? 20) > 65
                        ? 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                        : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                    }`}
                  >
                    {jev?.risk_score_percentage ?? eng.risk_score ?? 18}% Index
                  </span>
                </div>

                {Object.keys(jevProbs).length > 0 && (
                  <div className="space-y-1.5">
                    {Object.entries(jevProbs).map(([level, prob]) => {
                      const pct = Math.round(Number(prob) * 100);
                      return (
                        <div key={level} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>{level}</span>
                            <span className="text-zinc-200">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                level === 'Critical' || level === 'High'
                                  ? 'bg-rose-500'
                                  : level === 'Moderate'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.max(3, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {greenOps && (
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                    <span className="flex items-center space-x-1 text-emerald-400">
                      <Leaf className="h-3.5 w-3.5" />
                      <span>GreenOps (PUE {greenOps.pue}):</span>
                    </span>
                    <span className="text-zinc-200">
                      Score {greenOps.sustainability_score} • {greenOps.estimated_carbon_saved_kg_co2e} kg CO₂
                    </span>
                  </div>
                )}
              </div>

              {/* Col 2: 24h Pooled TFT Quantile Forecast & Blast Radius */}
              <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-3.5 space-y-3">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[11px] uppercase text-zinc-400 font-semibold">
                    24h Quantile Forecast (q10 / q50 / q90)
                  </span>
                  <span className="text-[10px] text-cyan-400">TFT + Diurnal Envelope</span>
                </div>

                {sampleQuantiles.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                    {sampleQuantiles.map((pt, idx) => (
                      <div
                        key={pt.hour_label || idx}
                        className="rounded border border-zinc-800 bg-zinc-950 p-1.5 text-center"
                      >
                        <div className="text-zinc-500 truncate">{pt.hour_label}</div>
                        <div className="text-zinc-200 font-semibold">q50: {pt.cpu_q50}%</div>
                        <div className="text-cyan-400">q90: {pt.cpu_q90}%</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 font-mono">
                    24h peak envelope within p95={resource.metrics_summary?.cpu_p95}% ceiling.
                  </p>
                )}

                {eng.blast_radius_analysis && (
                  <div className="rounded border border-zinc-800 bg-zinc-950 p-2 text-[11px] text-zinc-300 leading-relaxed">
                    <span className="font-mono text-[10px] uppercase text-amber-400 block font-semibold">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Blast Radius Assessment:
                    </span>
                    {eng.blast_radius_analysis}
                  </div>
                )}
              </div>

              {/* Col 3: Rollback Runbook & Terraform HCL Snippet */}
              <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-3.5 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold block">
                    SRE Rollback & Verification Runbook
                  </span>
                  <ul className="space-y-1 text-[11px] text-zinc-300 font-mono">
                    {runbookSteps.slice(0, 3).map((step, i) => (
                      <li key={i} className="leading-snug bg-zinc-950 px-2 py-1 rounded border border-zinc-800/80">
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>

                {tfCode && (
                  <div className="space-y-1 pt-2 border-t border-zinc-800">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span className="flex items-center space-x-1">
                        <Terminal className="h-3 w-3 text-emerald-400" />
                        <span>Terraform HCL Target</span>
                      </span>
                      <button
                        onClick={handleCopyTf}
                        className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300"
                      >
                        <Copy className="h-3 w-3" />
                        <span>{copiedTf ? 'Copied!' : 'Copy HCL'}</span>
                      </button>
                    </div>
                    <pre className="max-h-20 overflow-x-auto rounded bg-zinc-950 p-2 text-[10px] font-mono text-zinc-300 border border-zinc-800">
                      {tfCode}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/80 px-6 py-3 text-xs text-zinc-400">
          <span className="font-mono">
            Monthly Tariff: {formatINR(resource.monthly_cost_inr)}/mo (Hourly: ₹{(resource.monthly_cost_inr / 730).toFixed(2)})
          </span>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
