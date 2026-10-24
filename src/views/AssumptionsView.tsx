import React from 'react';
import type { AssumptionsResponse, PricingPlan, FormulaAssumption } from '../types/api';
import { formatINR } from '../utils/format';

interface AssumptionsViewProps {
  assumptions: AssumptionsResponse;
}

export const AssumptionsView: React.FC<AssumptionsViewProps> = ({ assumptions }) => {
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
        cpu_p95: '95th percentile CPU over 30-day continuous rolling window',
        cpu_p99: '99th percentile CPU over 30-day continuous rolling window',
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
        RAM_p95: '95th percentile memory usage across 30 days',
        Candidate_RAM: 'Provisioned RAM of the smaller cloud plan',
      },
    },
    {
      name: 'Off-Hours Scheduling Savings',
      category: 'Dev / Staging Scheduling',
      formula_math: 'Monthly_Savings = Monthly_Cost * (Shutdown_Hours_Per_Week / 168)',
      explanation:
        'Calculates financial yield from halting non-production VMs when developers are off-duty (8 PM - 8 AM IST Mon-Fri + full weekend = 118 hours/week shutdown).',
      variables: {
        Shutdown_Hours_Per_Week: 'Hours per week instance is in powered-off state (max 168)',
        '168': 'Total hours in a 7-day calendar week',
        Monthly_Cost: 'Baseline 744-hour monthly reservation price in INR',
      },
    },
    {
      name: 'Sustainability & Carbon Reduction',
      category: 'ESG & Green FinOps',
      formula_math: 'CO2_kg = kWh_Saved * 0.75 (Indian Central Grid Factor kg CO2e / kWh)',
      explanation:
        'Translates compute capacity reduction into avoided electricity draw and greenhouse gas emissions using the Indian Central Electricity Authority baseline.',
      variables: {
        kWh_Saved: 'vCPU_reduced * 12.5 W average TDP * operating_hours / 1000',
        '0.75': 'Central Electricity Authority (CEA) India average grid emission factor',
        Trees_Equiv: 'Total kg CO2 saved / 22 kg (annual carbon sequestered per mature tree)',
      },
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* View Header */}
      <div className="border-b border-black/[0.07] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[#111318]">
          Cost Transparency &amp; Engineering Formula Ledger
        </h1>
        <p className="text-xs text-[#525866] mt-1">
          Full auditability for all pricing assumptions, peak-safety mathematical governors, off-hours schedules, and carbon abatement calculations.
        </p>
      </div>

      {/* Explicit Mathematical Formulas Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#111318]">
            Core FinOps Mathematical Governors &amp; Formulas
          </h2>
          <span className="rounded-lg glass-pill-neutral px-2.5 py-0.5 text-[11px] font-mono font-bold">
            {formulaList.length} Rigorous Algorithms
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formulaList.map((formula, idx) => (
            <div
              key={idx}
              className="rounded-2xl glass-card p-5 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
                <div>
                  <h3 className="text-sm font-bold text-[#111318]">{formula.name}</h3>
                  <span className="text-[11px] font-mono text-[#68707E]">{formula.category}</span>
                </div>
                <span className="rounded-md status-green px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase">
                  Deterministic
                </span>
              </div>

              <div className="rounded-lg glass-well p-3 font-mono text-xs text-[#111318] font-bold tracking-wide">
                <code>{formula.formula_math}</code>
              </div>

              <p className="text-xs text-[#525866] leading-relaxed">
                {formula.explanation}
              </p>

              {formula.variables && (
                <div className="space-y-1.5 pt-2 border-t border-black/[0.06]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#68707E] block">
                    Variable Definitions
                  </span>
                  <div className="space-y-1 font-mono text-[11px]">
                    {Object.entries(formula.variables).map(([k, v]) => (
                      <div key={k} className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                        <span className="text-[#111318] font-bold">{k}:</span>
                        <span className="text-[#525866] font-sans text-xs">{v}</span>
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
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#111318]">
            Utho Cloud Pricing Catalog (INR Tiers)
          </h2>
          <span className="text-xs font-mono text-[#68707E]">
            Source: Utho Cloud Live Tariff Engine
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl glass-card">
          <div
            tabIndex={0}
            role="region"
            aria-label="Utho Cloud Pricing Catalog Table"
            className="table-wrapper"
          >
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] text-[#525866] font-label-caps text-label-caps uppercase">
                  <th className="px-4 py-3">Plan Identifier</th>
                  <th className="px-3 py-3">vCPU</th>
                  <th className="px-3 py-3">RAM</th>
                  <th className="px-3 py-3 text-right">Hourly Tariff (₹)</th>
                  <th className="px-3 py-3 text-right">Monthly Tariff (₹)</th>
                  <th className="px-4 py-3">Target Workload Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] font-mono">
                {catalogList.map((plan) => (
                  <tr key={plan.plan} className="hover:bg-black/[0.025] transition-colors">
                    <td className="px-4 py-2.5 font-bold text-[#111318]">
                      {plan.plan}
                    </td>
                    <td className="px-3 py-2.5 text-[#525866]">
                      {plan.vcpu > 0 ? `${plan.vcpu} vCPU` : '0 vCPU'}
                    </td>
                    <td className="px-3 py-2.5 text-[#525866]">
                      {plan.ram_gb > 0 ? `${plan.ram_gb} GB` : '0 GB'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#111318]">
                      ₹{plan.hourly_inr.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#1D5C46]">
                      {formatINR(plan.monthly_inr)}
                    </td>
                    <td className="px-4 py-2.5 font-sans text-xs text-[#525866]">
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
