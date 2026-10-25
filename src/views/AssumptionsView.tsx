import React from 'react';
import type { AssumptionsResponse, PricingPlan } from '../types/api';
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

      {/* Utho Cloud INR Pricing Catalog Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#111318]">
            Utho Cloud Pricing Catalog (INR Tiers)
          </h2>
          <span className="text-xs font-sans text-[#68707E]">
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
              <tbody className="divide-y divide-black/[0.05] font-sans">
                {catalogList.map((plan) => (
                  <tr key={plan.plan} className="hover:bg-black/[0.025] transition-colors">
                    <td className="px-4 py-2.5 font-bold text-[#111318]">
                      {plan.plan}
                    </td>
                    <td className="px-3 py-2.5 text-[#525866] tabular-nums">
                      {plan.vcpu > 0 ? `${plan.vcpu} vCPU` : '0 vCPU'}
                    </td>
                    <td className="px-3 py-2.5 text-[#525866] tabular-nums">
                      {plan.ram_gb > 0 ? `${plan.ram_gb} GB` : '0 GB'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-[#111318] tabular-nums">
                      ₹{plan.hourly_inr.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#1D5C46] tabular-nums">
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
