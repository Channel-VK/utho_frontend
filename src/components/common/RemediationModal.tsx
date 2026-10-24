import React, { useState } from 'react';
import { X, Copy, Check, Terminal, FileSpreadsheet, Download, Layers } from 'lucide-react';
import type { RemediationExport } from '../../types/api';

interface RemediationModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportData: RemediationExport | null;
  isLoading: boolean;
}

export const RemediationModal: React.FC<RemediationModalProps> = ({
  isOpen,
  onClose,
  exportData,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'cli' | 'terraform' | 'csv'>('cli');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentContent =
    activeTab === 'cli'
      ? exportData?.utho_cli_script || ''
      : activeTab === 'terraform'
      ? exportData?.terraform_hcl || ''
      : exportData?.csv_report || '';

  const handleCopy = () => {
    if (!currentContent) return;
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (!exportData?.csv_report) return;
    const blob = new Blob([exportData.csv_report], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `utho_finops_remediation_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-emerald-400">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Export Remediation Manifests</h2>
              <p className="text-xs text-zinc-400">Zero-touch automated scripts for committed FinOps recommendations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Controls & Copy Button */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60 px-6 py-2.5">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('cli')}
              className={`flex items-center space-x-2 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'cli'
                  ? 'border border-zinc-700 bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span>Utho CLI Script (.sh)</span>
            </button>

            <button
              onClick={() => setActiveTab('terraform')}
              className={`flex items-center space-x-2 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'terraform'
                  ? 'border border-zinc-700 bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span>Terraform HCL (.tf)</span>
            </button>

            <button
              onClick={() => setActiveTab('csv')}
              className={`flex items-center space-x-2 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'csv'
                  ? 'border border-zinc-700 bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />
              <span>Executive CSV Audit</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab === 'csv' && (
              <button
                onClick={handleDownloadCsv}
                className="flex items-center space-x-1.5 rounded border border-emerald-600/40 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-900/50 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download .csv</span>
              </button>
            )}

            <button
              onClick={handleCopy}
              disabled={isLoading || !currentContent}
              className="flex items-center space-x-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Copy Snippet</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-xs font-mono text-zinc-500">
              Generating reproducible remediation artifacts...
            </div>
          ) : (
            <pre className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 leading-relaxed">
              <code>{currentContent}</code>
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/80 px-6 py-3 text-xs text-zinc-400">
          <span className="font-mono">
            Directly executable via <code className="text-zinc-300">utho-cli v2.4+</code> or Terraform Utho Provider.
          </span>
          <button
            onClick={onClose}
            className="rounded border border-zinc-700 bg-zinc-800 px-4 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
