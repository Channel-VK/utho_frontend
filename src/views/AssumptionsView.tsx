import React from 'react';
import {
  FileSpreadsheet,
  Cpu,
} from 'lucide-react';
import type { AssumptionsResponse, PricingPlan, FormulaAssumption } from '../types/api';
import { formatINR } from '../utils/format';

interface AssumptionsViewProps {
  assumptions: AssumptionsResponse;
}

export const AssumptionsView: React.FC<AssumptionsViewProps> = ({ assumptions }) => {
  // Normalize pricing catalog (whether array or object map from Go backend)
  const rawCatalog = assumptions.pricing_catalog || {};
  const catalogList: PricingPlan[] = Array.isArray(rawCatalog)
    ? rawCatalog
    : Object.entries(rawCatalog).map(([k, v]: [string, any]) => ({
        plan: v.name || k,
        vcpu: v.vcpu ?? 0,
        ram_gb: v.ram_gb ?? 0,
        hourly_inr: v.hourly_rate_inr ?? v.hourly_inr ?? 0,
        monthly_inr: v.monthly_rate_inr ?? v.monthly_inr ?? 0,
        target_workload:
          v.vcpu > 0
            ? `${v.vcpu} vCPU / ${v.ram_gb} GB General Workload`
            : k.includes('vol') || k.includes('ssd')
            ? 'High IOPS NVMe SSD'
            : 'Elastic Public IPv4',
      }));

  // Build formula list from assumptions.formulas or safety_formulas
  const formulaList: FormulaAssumption[] = assumptions.formulas || [
    {
      name: 'Peak-Safe Rightsizing Governor',
      category: 'Rightsizing & Safety',
      formula_math:
        assumptions.safety_formulas?.projected_p99_ceiling ||
        'Projected CPU p99 = (Current vCPU * Observed p99) / (Candidate vCPU) < 85%',
      explanation:
        assumptions.safety_formulas?.peak_safety_guard ||
        'If observed p99 >= 85.0% or bursty peak pattern, instance is classified as PROTECTED_PEAK_LOAD and downsizing is blocked.',
      variables: {
        'cpu_p95': '95th percentile CPU over 30-day continuous rolling window',
        'cpu_p99': '99th percentile CPU over 30-day continuous rolling window',
        '1.25': '25% safety headroom buffer multiplier',
        '85% ceiling': 'Absolute maximum permissible utilization under traffic bursts',
      },
    },
    {
      name: 'RAM Safety Headroom Governor',
      category: 'Memory Safety',
      formula_math:
        assumptions.safety_formulas?.ram_safety_ceiling ||
        'Projected RAM p95 = (Current RAM * Observed p95) / (Candidate RAM) < 75%',
      explanation:
        'Prevents out-of-memory (OOM) kernel kills by enforcing a strict 75% memory ceiling on downsized targets.',
      variables: {
        'RAM_p95': '95th percentile memory usage across 30 days',
        'Candidate_RAM': 'Provisioned RAM of the smaller cloud plan',
      },
    },
    {
      name: 'Off-Hours Scheduling Savings',
      category: 'Dev / Staging Scheduling',
      formula_math: 'Monthly_Savings = Monthly_Cost * (Shutdown_Hours_Per_Week / 168)',
      explanation:
        'Calculates financial yield from halting non-production VMs when developers are off-duty (8 PM - 8 AM IST Mon-Fri + full weekend = 118 hours/week shutdown).',
      variables: {
        'Shutdown_Hours_Per_Week': 'Hours per week instance is in powered-off state (max 168)',
        '168': 'Total hours in a 7-day calendar week',
        'Monthly_Cost': 'Baseline 744-hour monthly reservation price in INR',
      },
    },
    {
      name: 'Sustainability & Carbon Reduction',
      category: 'ESG & Green FinOps',
      formula_math: 'CO2_kg = kWh_Saved * 0.75 (Indian Central Grid Factor kg CO2e / kWh)',
      explanation:
        'Translates compute capacity reduction into avoided electricity draw and greenhouse gas emissions using the Indian Central Electricity Authority baseline.',
      variables: {
        'kWh_Saved': 'vCPU_reduced * 12.5 W average TDP * operating_hours / 1000',
        '0.75': 'Central Electricity Authority (CEA) India average grid emission factor',
        'Trees_Equiv': 'Total kg CO2 saved / 22 kg (annual carbon sequestered per mature tree)',
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="border-b border-zinc-800/80 pb-4">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Cost Transparency & Engineering Formula Ledger
          </h1>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          Full public auditability for all pricing assumptions, peak-safety mathematical governors, off-hours schedules, and carbon abatement calculations.
        </p>
      </div>

      {/* Explicit Mathematical Formulas Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Core FinOps Mathematical Governors & Formulas
          </h2>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
            {formulaList.length} Rigorous Algorithms
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formulaList.map((formula, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 space-y-3 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-100">{formula.name}</h3>
                  <span className="text-[10px] font-mono text-zinc-400">{formula.category}</span>
                </div>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                  Deterministic
                </span>
              </div>

              {/* Mathematical Equation Block */}
              <div className="rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-emerald-400 font-semibold tracking-wide">
                <code>{formula.formula_math}</code>
              </div>

              {/* Explanation */}
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                {formula.explanation}
              </p>

              {/* Variables Dictionary */}
              {formula.variables && (
                <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 block">
                    Variable Definitions
                  </span>
                  <div className="space-y-1 font-mono text-[11px]">
                    {Object.entries(formula.variables).map(([k, v]) => (
                      <div key={k} className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-zinc-400">
                        <span className="text-zinc-200 font-semibold">{k}:</span>
                        <span className="text-zinc-400 font-sans text-xs">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Utho Cloud INR Pricing Catalog Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Utho Cloud Pricing Catalog (INR Tiers)
            </h2>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            Source: Utho Cloud Live Tariff Engine (2026)
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Plan Identifier</th>
                  <th className="px-3 py-3">vCPU</th>
                  <th className="px-3 py-3">RAM</th>
                  <th className="px-3 py-3 text-right">Hourly Tariff (₹)</th>
                  <th className="px-3 py-3 text-right">Monthly Tariff (₹)</th>
                  <th className="px-4 py-3">Target Workload Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {catalogList.map((plan) => (
                  <tr key={plan.plan} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-zinc-200">
                      {plan.plan}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {plan.vcpu > 0 ? `${plan.vcpu} vCPU` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {plan.ram_gb > 0 ? `${plan.ram_gb} GB` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">
                      ₹{plan.hourly_inr.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-400">
                      {formatINR(plan.monthly_inr)}
                    </td>
                    <td className="px-4 py-2.5 font-sans text-xs text-zinc-400">
                      {plan.target_workload}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
