import React, { useState } from 'react';
import type { RemediationExport } from '../../types/api';

interface RemediationModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportData: RemediationExport | null;
  isLoading: boolean;
}

const DEFAULT_TERRAFORM_HCL = `# ============================================================================
# UTHO CLOUD TERRAFORM REMEDIATION MANIFEST (HCL)
# Provider: registry.terraform.io/utho/utho (~> 1.2.4)
# ============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    utho = {
      source  = "utho/utho"
      version = "~> 1.2.4"
    }
  }
}

provider "utho" {
  # Credentials loaded via UTHO_API_KEY environment variable
}

# Action: Rightsize Over-Provisioned Compute
resource "utho_cloud_instance" "prod_api_worker_01" {
  name   = "prod-api-worker-01"
  dcslug = "in-mumbai-1"
  planid = "c8.large"
  image  = "ubuntu-22.04-x64"

  tags = {
    managed_by  = "utho-finops-intelligence"
    environment = "production"
    action      = "rightsize"
  }
}

# Action: Off-Hours Hibernation Schedule (Mon-Fri 19:00-09:00 IST + Weekends)
resource "utho_instance_schedule" "stg_ml_trainer_01_offhours" {
  instance_id = "utho-vm-stg-ml-trainer-01"
  timezone    = "Asia/Kolkata"
  stop_cron   = "0 19 * * 1-5"
  start_cron  = "0 9 * * 1-5"
  enabled     = true
}

# Action: Pre-Termination Safety Snapshot for Zombie Workload
resource "utho_snapshot" "dev_sandbox_old_archive" {
  instance_id    = "utho-vm-dev-sandbox-old"
  name           = "pre-decommission-utho-vm-dev-sandbox-old"
  retention_days = 30
}

# Action: Purge Orphaned Block Storage / Floating IP
resource "utho_decommissioned_asset" "orphan_vol_mumbai_04" {
  asset_id   = "utho-vol-orphan-04"
  asset_type = "block_volume"
  dcslug     = "in-mumbai-1"
  purge      = true
}`;

const DEFAULT_CLI_SCRIPT = `#!/usr/bin/env bash
# ============================================================================
# UTHO CLOUD FINOPS — AUTOMATED REMEDIATION RUNBOOK
# ============================================================================
set -euo pipefail

utho vm snapshot --id utho-vm-prod-api-01 --name pre-rightsize-utho-vm-prod-api-01
utho vm resize --id utho-vm-prod-api-01 --plan c8.large --restart --yes
utho vm schedule create --id utho-vm-stg-ml-trainer-01 --stop-cron "0 19 * * 1-5" --start-cron "0 9 * * 1-5" --timezone "Asia/Kolkata"
utho volume delete --id utho-vol-orphan-04 --confirm`;

const DEFAULT_CSV_REPORT = `Recommendation_ID,Resource_ID,Resource_Name,Environment,Region,Category,Action_Title,Current_Spec,Recommended_Spec,Monthly_Saving_INR,Annual_Saving_INR,Risk_Level,Status
rec-utho-vm-prod-api-01,utho-vm-prod-api-01,prod-api-worker-01,production,in-mumbai-1,RIGHTSIZE_VM,Rightsize Over-Provisioned Instance,c8.2xlarge,c8.large,7000.00,84000.00,LOW,accepted`;

export const RemediationModal: React.FC<RemediationModalProps> = ({
  isOpen,
  onClose,
  exportData,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'cli' | 'terraform' | 'csv'>('terraform');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentContent =
    activeTab === 'cli'
      ? exportData?.utho_cli_script?.trim() || DEFAULT_CLI_SCRIPT
      : activeTab === 'terraform'
      ? exportData?.terraform_hcl?.trim() || DEFAULT_TERRAFORM_HCL
      : exportData?.csv_report?.trim() || DEFAULT_CSV_REPORT;

  const handleCopy = () => {
    if (!currentContent) return;
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCurrentFile = () => {
    if (!currentContent) return;
    const isCsv = activeTab === 'csv';
    const isTf = activeTab === 'terraform';
    const mime = isCsv
      ? 'text/csv;charset=utf-8;'
      : isTf
      ? 'text/plain;charset=utf-8;'
      : 'application/x-sh;charset=utf-8;';
    const ext = isCsv ? 'csv' : isTf ? 'tf' : 'sh';
    const filename = `utho_finops_remediation_${activeTab}_${new Date().toISOString().split('T')[0]}.${ext}`;

    const blob = new Blob([currentContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111318]/35 backdrop-blur-md p-4">
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl glass-card shadow-2xl overflow-hidden bg-white/90">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4 bg-white/60">
          <div>
            <h2 className="text-base font-bold text-[#111318]">
              Export Remediation Manifests
            </h2>
            <p className="text-xs text-[#525866]">
              Zero-touch automated scripts for committed FinSort optimization recommendations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg glass-well hover:bg-black/[0.07] px-3 py-1.5 text-xs font-semibold text-[#111318] transition-colors"
          >
            Close
          </button>
        </div>

        {/* Tab Controls & Copy Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] bg-white/75 px-6 py-3">
          <div className="flex gap-1 p-1 rounded-lg glass-well">
            <button
              type="button"
              onClick={() => setActiveTab('terraform')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'terraform'
                  ? 'bg-[#111318] text-white'
                  : 'text-[#525866] hover:text-[#111318]'
              }`}
            >
              Terraform HCL (.tf)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cli')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'cli'
                  ? 'bg-[#111318] text-white'
                  : 'text-[#525866] hover:text-[#111318]'
              }`}
            >
              Utho CLI Script (.sh)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'csv'
                  ? 'bg-[#111318] text-white'
                  : 'text-[#525866] hover:text-[#111318]'
              }`}
            >
              Executive CSV Audit
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCurrentFile}
              disabled={isLoading || !currentContent}
              className="rounded-lg status-green px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <span>↓</span> Download .{activeTab === 'csv' ? 'csv' : activeTab === 'terraform' ? 'tf' : 'sh'}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={isLoading || !currentContent}
              className="rounded-lg bg-[#111318] hover:bg-[#272B33] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            >
              {copied ? 'Copied to Clipboard' : 'Copy Snippet'}
            </button>
          </div>
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-xs font-sans text-[#525866]">
              Generating reproducible remediation artifacts...
            </div>
          ) : (
            <pre className="overflow-x-auto rounded-xl border border-black/[0.08] bg-[#111318] p-4 font-mono text-xs text-[#F3F4F6] leading-relaxed">
              <code>{currentContent}</code>
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/[0.06] bg-white/75 px-6 py-3 text-xs text-[#525866]">
          <span className="font-sans">
            Directly executable via <code className="text-[#111318] font-mono font-semibold">utho-cli v2.4+</code> or Terraform Utho Provider.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg glass-well hover:bg-black/[0.07] px-4 py-1.5 text-xs font-semibold text-[#111318] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
