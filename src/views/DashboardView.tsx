import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Leaf,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  MapPin,
  Cpu,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type {
  DashboardResponse,
  Recommendation,
  AIForecastResponse,
  AIBriefingResponse,
} from '../types/api';
import { apiClient } from '../api/client';
import { formatINR, formatNumber } from '../utils/format';
import { MondayRunbookStrip } from '../components/common/MondayRunbookStrip';

interface DashboardViewProps {
  data: DashboardResponse;
  recommendations?: Recommendation[];
  onNavigateToInventory: (filterStatus?: string) => void;
  onNavigateToRecommendations: (filterAction?: string) => void;
  onNavigateToAlerts: () => void;
  onAcceptCategory?: (category: 'orphan' | 'off_hours' | 'rightsize') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  recommendations = [],
  onNavigateToInventory,
  onNavigateToRecommendations,
  onNavigateToAlerts,
  onAcceptCategory,
}) => {
  const [briefingRole, setBriefingRole] = useState<'executive' | 'finance' | 'engineering'>('executive');
  const [briefing, setBriefing] = useState<AIBriefingResponse | null>(null);
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(60);
  const [aiForecast, setAiForecast] = useState<AIForecastResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.getAIBriefing(briefingRole).then((res) => {
      if (!cancelled) setBriefing(res);
    });
    return () => {
      cancelled = true;
    };
  }, [briefingRole, data.accepted_monthly_savings_inr]);

  useEffect(() => {
    let cancelled = false;
    apiClient.getAIForecast(horizonDays, 25).then((res) => {
      if (!cancelled) setAiForecast(res);
    });
    return () => {
      cancelled = true;
    };
  }, [horizonDays, data.accepted_monthly_savings_inr]);

  // Normalize historical chart points for Recharts (supports total_inr and spend_inr)
  const normalizedHistorical = (data.historical_spend_6m || []).map((item) => ({
    month: item.month,
    spend_inr: item.total_inr ?? item.spend_inr ?? 0,
    compute_inr: item.compute_inr,
    storage_inr: item.storage_inr,
  }));

  // Normalize forecast points (supports date/day and do_nothing_inr/unoptimized_inr)
  const normalizedForecast = (data.forecast_60d || []).map((item) => ({
    displayDate: item.date ? item.date.slice(5) : item.day || 'Day',
    unoptimized_inr: item.do_nothing_inr ?? item.unoptimized_inr ?? 0,
    optimized_inr: item.optimized_inr,
  }));

  const handleCategoryAction = (category: 'orphan' | 'off_hours' | 'rightsize') => {
    if (onAcceptCategory) {
      onAcceptCategory(category);
    } else {
      onNavigateToRecommendations();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Executive FinOps & Cost Optimization Cockpit
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time telemetry and bill projections across <span className="font-mono text-zinc-300">in-noida-1</span>,{' '}
            <span className="font-mono text-zinc-300">in-bangalore-1</span>, and{' '}
            <span className="font-mono text-zinc-300">in-mumbai-1</span>.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigateToRecommendations()}
            className="flex items-center space-x-1.5 rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-900/40 transition-colors shadow-xs"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Open Action Plan Ledger</span>
          </button>
        </div>
      </div>

      {/* Monday Morning 3-Step Runbook Strip */}
      {recommendations.length > 0 && (
        <MondayRunbookStrip
          recommendations={recommendations}
          protectedCount={data.protected_peak_vms_count}
          onAcceptCategory={handleCategoryAction}
          onFilterRightsizing={() => onNavigateToRecommendations('RIGHTSIZE_VM')}
        />
      )}

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Current Run-rate */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Current Monthly Spend</span>
            <TrendingUp className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="font-mono text-xl font-bold text-zinc-100">
              {formatINR(data.current_monthly_spend_inr)}
            </div>
            <span className="flex items-center text-[11px] font-mono font-medium text-rose-400">
              <ArrowUpRight className="h-3 w-3 mr-0.5" />
              +{data.bill_growth_6m_pct}%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">Past 6 months unmanaged sprawl</div>
        </div>

        {/* Projected Spend */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Projected Spend</span>
            <Layers className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="font-mono text-xl font-bold text-emerald-400">
              {formatINR(data.projected_monthly_spend_inr)}
            </div>
            <span className="flex items-center text-[11px] font-mono font-medium text-emerald-400">
              <ArrowDownRight className="h-3 w-3 mr-0.5" />
              -{data.accepted_savings_pct}%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">Target run-rate post accepted changes</div>
        </div>

        {/* Net Monthly Savings */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/15 p-4 shadow-sm hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between text-emerald-400/80">
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">Committed Savings</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="font-mono text-xl font-bold text-emerald-400">
              {formatINR(data.accepted_monthly_savings_inr)}
              <span className="text-xs font-normal text-emerald-500/70">/mo</span>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-emerald-500/70 font-mono">
            {formatINR(data.total_potential_savings_inr)} total pipeline potential
          </div>
        </div>

        {/* Protected Peak Workloads */}
        <div
          onClick={() => onNavigateToInventory('PROTECTED_PEAK_LOAD')}
          className="cursor-pointer rounded-lg border border-cyan-500/20 bg-cyan-950/15 p-4 shadow-sm hover:border-cyan-500/40 transition-colors"
        >
          <div className="flex items-center justify-between text-cyan-400/80">
            <span className="text-xs font-medium uppercase tracking-wider text-cyan-400">Protected Peak VMs</span>
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="font-mono text-xl font-bold text-cyan-300">
              {data.protected_peak_vms_count} Workloads
            </div>
            <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
              Governor Active
            </span>
          </div>
          <div className="mt-1 text-[11px] text-cyan-400/70">
            Downsizing blocked to protect latency SLAs
          </div>
        </div>

        {/* Active Capacity & Waste Alerts */}
        <div
          onClick={onNavigateToAlerts}
          className="cursor-pointer rounded-lg border border-rose-500/20 bg-rose-950/15 p-4 shadow-sm hover:border-rose-500/40 transition-colors"
        >
          <div className="flex items-center justify-between text-rose-400/80">
            <span className="text-xs font-medium uppercase tracking-wider text-rose-400">Capacity & Waste Alerts</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="font-mono text-xl font-bold text-rose-300">
              {data.active_alerts_count} Active
            </div>
            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono text-rose-300 border border-rose-500/30">
              Needs Attention
            </span>
          </div>
          <div className="mt-1 text-[11px] text-rose-400/70">
            Memory leak + forgotten nodes
          </div>
        </div>
      </div>

      {/* Compact AI Intelligence & Multi-Horizon Cost Forecaster (Python AI :8001) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 p-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 7 Cols: Role-Based AI Briefing */}
          <div className="lg:col-span-7 space-y-3 lg:border-r lg:border-zinc-800 lg:pr-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200 font-mono">
                  AI Role Briefing ({briefing?.provider || 'Python-AI-Service :8001'})
                </span>
              </div>

              <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-950 p-0.5 font-mono text-[11px]">
                {(['executive', 'finance', 'engineering'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setBriefingRole(r)}
                    className={`rounded px-2.5 py-1 capitalize transition-colors ${
                      briefingRole === r
                        ? 'bg-zinc-800 text-emerald-400 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {briefing && (
              <>
                <p className="text-xs font-medium text-zinc-100 leading-snug">
                  {briefing.headline}
                </p>

                <ul className="space-y-1 text-[11px] text-zinc-300 font-mono">
                  {(briefing.bullet_points || []).slice(0, 3).map((pt, idx) => (
                    <li key={idx} className="flex items-start space-x-1.5 leading-snug">
                      <span className="text-emerald-400 shrink-0">▸</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono">
                  {(briefing.key_metrics || []).map((pill, i) => (
                    <div
                      key={i}
                      className="rounded border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1 text-[10px] text-emerald-300"
                    >
                      <span className="text-zinc-400 mr-1.5">{pill.label}:</span>
                      <span className="font-bold">{pill.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right 5 Cols: Multi-Horizon Component Cost Forecaster (30d / 60d / 90d) */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-between font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Multi-Horizon Cost Forecaster
                </span>
              </div>

              <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-950 p-0.5 text-[11px]">
                {([30, 60, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setHorizonDays(d)}
                    className={`rounded px-2 py-0.5 transition-colors ${
                      horizonDays === d
                        ? 'bg-zinc-800 text-cyan-300 font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {aiForecast && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
                    <span className="text-[10px] uppercase text-zinc-500 block">
                      {horizonDays}d Baseline
                    </span>
                    <span className="text-xs font-bold text-zinc-200">
                      {formatINR(aiForecast.current_cost_inr.total)}
                    </span>
                  </div>
                  <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
                    <span className="text-[10px] uppercase text-zinc-500 block">
                      {horizonDays}d Optimized
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      {formatINR(aiForecast.recommended_cost_inr.total)}
                    </span>
                  </div>
                  <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2">
                    <span className="text-[10px] uppercase text-emerald-400/80 block">
                      {horizonDays}d Net Saved
                    </span>
                    <span className="text-xs font-bold text-emerald-300">
                      +{formatINR(aiForecast.estimated_savings_inr)}
                    </span>
                  </div>
                </div>

                <div className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[10px] text-zinc-400 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    VM: <strong className="text-zinc-200">{formatINR(aiForecast.recommended_cost_inr.vm_compute)}</strong>
                  </span>
                  <span>
                    SSD: <strong className="text-zinc-200">{formatINR(aiForecast.current_cost_inr.storage)}</strong>
                  </span>
                  <span>
                    IPv4: <strong className="text-zinc-200">{formatINR(aiForecast.current_cost_inr.public_ip)}</strong>
                  </span>
                  <span className="text-emerald-400">
                    GreenScore: <strong>{aiForecast.sustainability.sustainability_score}</strong> (PUE {aiForecast.sustainability.pue})
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 6-Month Bill Creep Chart */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">6-Month Historical Bill Creep (+{data.bill_growth_6m_pct}%)</h2>
              <p className="text-xs text-zinc-400">Baseline spend climb without autonomous FinOps governance</p>
            </div>
            <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-rose-400">
              INR Monthly Bill
            </span>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={normalizedHistorical} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="creepGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#3f3f46',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                  formatter={(val: any) => [formatINR(Number(val)), 'Total Monthly Spend']}
                />
                <Area
                  type="monotone"
                  dataKey="spend_inr"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#creepGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 60-Day Spend Forecast Comparison */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">60-Day Forward Trajectory Projection</h2>
              <p className="text-xs text-zinc-400">Unoptimized expansion vs. After Accepted Recommendations</p>
            </div>
            <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
              Forecast 60d
            </span>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={normalizedForecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="unoptimizedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="optimizedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="displayDate" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#3f3f46',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                  formatter={(val: any, name: any) => [
                    formatINR(Number(val)),
                    name === 'unoptimized_inr' ? 'Unoptimized Trajectory' : 'After Accepted Rightsizing',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(val) =>
                    val === 'unoptimized_inr' ? 'Unoptimized Trajectory' : 'After Accepted Recommendations'
                  }
                />
                <Area
                  type="monotone"
                  dataKey="unoptimized_inr"
                  name="unoptimized_inr"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="url(#unoptimizedGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="optimized_inr"
                  name="optimized_inr"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#optimizedGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Breakdown by Environment and Region */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Environment Breakdown */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center space-x-2">
              <Layers className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Spend by Environment (Prod vs Staging vs Dev)</h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">Current vs Target</span>
          </div>

          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.spend_by_env} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="env" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#3f3f46',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                  formatter={(val: any, name: any) => [
                    formatINR(Number(val)),
                    name === 'current_inr' ? 'Current Spend' : 'Target Spend',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(val) => (val === 'current_inr' ? 'Current Run-Rate' : 'Projected Post-Optimization')}
                />
                <Bar dataKey="current_inr" fill="#52525b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="projected_inr" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Region Breakdown */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Spend by Utho Cloud Region</h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">in-noida / in-bangalore / in-mumbai</span>
          </div>

          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.spend_by_region} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="region" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#3f3f46',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                  formatter={(val: any, name: any) => [
                    formatINR(Number(val)),
                    name === 'current_inr' ? 'Current Spend' : 'Target Spend',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(val) => (val === 'current_inr' ? 'Current Spend' : 'Projected Spend')}
                />
                <Bar dataKey="current_inr" fill="#3f3f46" radius={[4, 4, 0, 0]} />
                <Bar dataKey="projected_inr" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sustainability & ESG Impact Strip */}
      <div className="rounded-lg border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-zinc-900/90 to-zinc-900/90 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-900/30 text-emerald-400">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-zinc-100">Green FinOps & Carbon Avoidance</h3>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                  CEA India Grid Baseline
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Eliminating overprovisioned compute and halting off-hours staging directly shrinks datacenter power draw.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="rounded border border-zinc-800 bg-zinc-950 px-3.5 py-2">
              <span className="text-[10px] uppercase text-zinc-400 block">Monthly Power Saved</span>
              <span className="text-sm font-bold text-emerald-400">
                {formatNumber(Math.round(data.sustainability.monthly_kwh_saved))} kWh
              </span>
            </div>

            <div className="rounded border border-zinc-800 bg-zinc-950 px-3.5 py-2">
              <span className="text-[10px] uppercase text-zinc-400 block">CO₂ Abated</span>
              <span className="text-sm font-bold text-emerald-400">
                {formatNumber(Math.round(data.sustainability.monthly_co2_kg_saved))} kg CO₂e
              </span>
            </div>

            <div className="rounded border border-zinc-800 bg-zinc-950 px-3.5 py-2">
              <span className="text-[10px] uppercase text-zinc-400 block">Equiv. Mature Trees</span>
              <span className="text-sm font-bold text-emerald-300">
                🌱 {Math.round(data.sustainability.trees_equivalent)} trees/yr
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
