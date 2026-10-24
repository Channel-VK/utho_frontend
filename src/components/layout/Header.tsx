import React from 'react';
import {
  ShieldCheck,
  Activity,
  Server,
  Terminal,
  Sliders,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'inventory' | 'recommendations' | 'simulator' | 'assumptions';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isConnected: boolean;
  isAIConnected?: boolean;
  isChecking: boolean;
  onCheckConnection: () => void;
  activeAlertsCount: number;
  pendingRecsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  isConnected,
  isAIConnected = false,
  isChecking,
  onCheckConnection,
  activeAlertsCount,
  pendingRecsCount,
}) => {
  const tabs = [
    { id: 'dashboard' as const, label: 'Overview', icon: Activity },
    { id: 'inventory' as const, label: 'Inventory', icon: Server },
    {
      id: 'recommendations' as const,
      label: `Action Plan (${pendingRecsCount > 0 ? pendingRecsCount : 28})`,
      icon: Terminal,
      highlight: pendingRecsCount > 0,
    },
    {
      id: 'simulator' as const,
      label: `Simulator & Alerts (${activeAlertsCount > 0 ? activeAlertsCount : 3})`,
      icon: Sliders,
    },
    { id: 'assumptions' as const, label: 'Pricing & Math', icon: FileSpreadsheet },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Clean Logo + Title */}
        <div
          onClick={() => onTabChange('dashboard')}
          className="flex items-center space-x-2.5 cursor-pointer shrink-0 mr-4"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-950/40 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">SmartCloud</span>
            <span className="text-[10px] uppercase font-mono font-medium text-emerald-400/90 border border-emerald-500/20 bg-emerald-950/30 px-1.5 py-0.2 rounded">
              FinOps
            </span>
          </div>
        </div>

        {/* Center: 5 Clean Single-Line Navigation Tabs (Linear style, never wrap) */}
        <nav className="flex items-center space-x-1 overflow-x-auto whitespace-nowrap scrollbar-none py-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border border-zinc-700 bg-zinc-850 bg-zinc-900 text-zinc-100 shadow-xs'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Compact Connected status indicator (Go :8080 • AI :8001) */}
        <div className="flex items-center space-x-2 shrink-0 ml-4">
          <div
            className={`flex items-center space-x-2 rounded-md border px-2.5 py-1 text-xs font-mono transition-colors whitespace-nowrap ${
              isConnected && isAIConnected
                ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-400'
                : isConnected
                ? 'border-emerald-500/20 bg-zinc-900/90 text-emerald-300'
                : 'border-zinc-800 bg-zinc-900/90 text-zinc-400'
            }`}
          >
            {/* Go :8080 Dot */}
            <span className="flex items-center space-x-1.5">
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></span>
              </span>
              <span className="text-[11px] font-medium">
                {isConnected ? 'Go :8080' : 'Local :8080'}
              </span>
            </span>

            <span className="text-zinc-600">•</span>

            {/* Python AI :8001 Dot */}
            <span className="flex items-center space-x-1.5">
              <span className="relative flex h-2 w-2">
                {isAIConnected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isAIConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></span>
              </span>
              <span
                className={`text-[11px] font-medium ${
                  isAIConnected ? 'text-emerald-400' : 'text-zinc-400'
                }`}
              >
                AI :8001
              </span>
            </span>
          </div>

          <button
            onClick={onCheckConnection}
            disabled={isChecking}
            title="Ping Go API (:8080) & Python AI Engine (:8001)"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
