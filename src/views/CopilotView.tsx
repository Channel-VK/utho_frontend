import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import type { ChatMessageItem } from '../types/api';
import { formatINR } from '../utils/format';

interface CopilotViewProps {
  isAIConnected?: boolean;
  onInspectResource?: (id: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

const QUICK_PROMPTS = [
  'Why did our SaaS cloud bill grow 40% in six months?',
  'What are our top 3 rightsizing candidates with projected p99 < 85%?',
  'Explain ALT-001 time-to-failure analysis and OOM risk',
  'What if we hibernate dev VMs in Bangalore from 8 PM to 8 AM?',
  'Audit orphaned resources: unattached volumes and unused IPs',
];

const BOOTSTRAP_TIME = new Date().toISOString();
const getNowIso = () => new Date().toISOString();

function formatTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function renderTelemetryValue(val: unknown, key?: string, depth = 0): React.ReactNode {
  if (val === null || val === undefined) return <span className="text-[#767D8C]">—</span>;

  if (typeof val === 'number') {
    const k = (key || '').toLowerCase();
    if (k.includes('inr') || k.includes('cost') || k.includes('saving') || k.includes('spend') || k.includes('bleed') || k.includes('runway') || k.includes('rate')) {
      return <span className="font-semibold text-[#111318]">{formatINR(val)}</span>;
    }
    if (k.includes('pct') || k.includes('percent') || k.includes('p95') || k.includes('p99') || k.includes('ratio')) {
      return <span>{val.toFixed(1)}%</span>;
    }
    return <span>{Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2)}</span>;
  }

  if (typeof val === 'boolean') {
    return <span className={val ? 'text-[#236B52] font-semibold' : 'text-[#767D8C]'}>{val ? 'Yes' : 'No'}</span>;
  }

  if (typeof val === 'string') {
    return <span>{val}</span>;
  }

  if (depth > 2) {
    try {
      return <span className="font-mono text-[10px]">{JSON.stringify(val)}</span>;
    } catch {
      return <span className="font-mono text-[10px]">—</span>;
    }
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-[#767D8C]">Empty</span>;
    const isPrimitive = val.every((item) => typeof item !== 'object' || item === null);
    if (isPrimitive) {
      return (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {val.map((item, idx) => (
            <span key={idx} className="inline-block px-1.5 py-0.5 rounded bg-black/[0.04] text-[10px] font-mono text-[#111318]">
              {item === null || item === undefined ? '—' : String(item)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-1.5 mt-1 max-h-56 overflow-y-auto pr-0.5">
        {val.slice(0, 8).map((item, idx) => (
          <div key={idx} className="p-2 bg-white/95 rounded-lg border border-black/[0.07] text-[10px] font-mono space-y-1 shadow-2xs">
            {typeof item === 'object' && item !== null ? (
              Object.entries(item).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-[#767D8C] capitalize truncate font-medium">{k.replace(/_/g, ' ')}:</span>
                  <div className="font-semibold text-[#111318] truncate text-right">
                    {renderTelemetryValue(v, k, depth + 1)}
                  </div>
                </div>
              ))
            ) : (
              <span>{item === null || item === undefined ? '—' : String(item)}</span>
            )}
          </div>
        ))}
        {val.length > 8 && (
          <div className="text-[9px] text-[#767D8C] text-center font-mono">+{val.length - 8} more items</div>
        )}
      </div>
    );
  }

  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-[#767D8C]">—</span>;
    return (
      <div className="space-y-1 mt-1 p-2 bg-white/90 rounded-lg border border-black/[0.06] shadow-2xs">
        {entries.map(([subK, subV]) => (
          <div key={subK} className="flex items-center justify-between text-[10px] gap-2 font-mono">
            <span className="text-[#767D8C] truncate capitalize font-medium">{subK.replace(/_/g, ' ')}:</span>
            <div className="font-semibold text-[#111318] truncate text-right">
              {renderTelemetryValue(subV, subK, depth + 1)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(val)}</span>;
}

export const CopilotView: React.FC<CopilotViewProps> = ({
  isAIConnected = false,
  onInspectResource: _onInspectResource,
}) => {
  const [conversationId, setConversationId] = useState<string>(() => `conv-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessageItem[]>(() => [
    {
      role: 'assistant',
      content:
        'FinSort Copilot online. Grounded across all 85 Utho Cloud resources (Noida, Bangalore, Mumbai), TimescaleDB telemetry, p95/p99 peak safety governors, and Indian Rupee (₹) pricing catalog. How can I assist your FinOps or SRE review today?',
      created_at: BOOTSTRAP_TIME,
      tool: 'copilot_bootstrap',
    },
  ]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessageItem = {
      role: 'user',
      content: query,
      created_at: getNowIso(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const resp = await apiClient.sendChatMessage(query, conversationId);
      if (resp.conversation_id) {
        setConversationId(resp.conversation_id);
      }
      const assistantMessage: ChatMessageItem = {
        role: 'assistant',
        content: resp.answer,
        created_at: getNowIso(),
        tool: resp.tool,
        data: resp.data,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessageItem = {
        role: 'assistant',
        content:
          'Error connecting to AI Copilot service. Local FinOps rules engine active: all 85 resources and p95/p99 safety constraints remain enforced.',
        created_at: getNowIso(),
        tool: 'fallback_handler',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResetConversation = () => {
    const newId = `conv-${Date.now()}`;
    setConversationId(newId);
    setMessages([
      {
        role: 'assistant',
        content:
          'New conversation initiated. Ready to audit rightsizing opportunities, parse What-If scenarios, or analyze anomaly blast radius across Utho Cloud regions.',
        created_at: new Date().toISOString(),
        tool: 'session_reset',
      },
    ]);
  };

  return (
    <div className="space-y-6 pb-12 max-w-[1400px] mx-auto">
      {/* COPILOT HEADER & TELEMETRY STATUS */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-[#111318] tracking-tight">
                FinSort Copilot
              </h2>
              <span
                className={`text-[10px] font-sans px-2 py-0.5 rounded-md font-semibold ${
                  isAIConnected ? 'status-green' : 'status-yellow'
                }`}
              >
                {isAIConnected ? 'Online' : 'Standby Engine'}
              </span>
            </div>
            <p className="text-xs text-[#767D8C]">
              Powered by gemini-3.8-flash with full live context: all 85 VMs, Block SSDs &amp; IPs, 30/60/90d TFT forecasts, approved &amp; pending rightsizing, and ₹ INR savings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="glass-well px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-sans text-[#4A505C]">
              <span className="text-[10px] text-[#767D8C] uppercase tracking-wider">Session:</span>
              <span className="text-[#111318] font-mono font-semibold">{conversationId.slice(0, 14)}...</span>
            </div>
            <button
              type="button"
              onClick={handleResetConversation}
              className="px-3 py-1.5 rounded-xl glass-well hover:bg-black/[0.06] text-xs font-semibold text-[#111318] transition-colors"
            >
              Reset Session
            </button>
          </div>
        </div>

        {/* Real-time Telemetry Pills */}
        <div className="mt-4 pt-4 border-t border-black/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-well p-3 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-[#767D8C] font-semibold">
              Fleet Indexed
            </div>
            <div className="text-sm font-semibold text-[#111318] mt-0.5">85 Utho Nodes</div>
            <div className="text-[10px] text-[#767D8C] font-sans mt-0.5">Noida · Blr · Mumbai</div>
          </div>

          <div className="glass-well p-3 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-[#767D8C] font-semibold">
              Time-Series DB
            </div>
            <div className="text-sm font-semibold text-[#111318] mt-0.5">TimescaleDB Telemetry</div>
            <div className="text-[10px] text-[#236B52] font-sans mt-0.5">Hypertables Synced</div>
          </div>

          <div className="glass-well p-3 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-[#767D8C] font-semibold">
              Peak Safety
            </div>
            <div className="text-sm font-semibold text-[#111318] mt-0.5">p95/p99 Governor</div>
            <div className="text-[10px] text-[#111318] font-sans tabular-nums mt-0.5">Projected p99 &lt; 85%</div>
          </div>

          <div className="glass-well p-3 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-[#767D8C] font-semibold">
              Currencies &amp; SLA
            </div>
            <div className="text-sm font-semibold text-[#111318] mt-0.5">₹ Indian Rupee</div>
            <div className="text-[10px] text-[#236B52] font-sans mt-0.5">Zero Downtime Risk</div>
          </div>
        </div>
      </div>

      {/* CONVERSATION FEED */}
      <div className="glass-card rounded-2xl p-6 min-h-[460px] flex flex-col justify-between">
        <div className="space-y-4 overflow-y-auto max-h-[560px] pr-2">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
              >
                {/* Sender badge */}
                <div className="flex items-center gap-2 px-1 text-[11px] font-sans text-[#767D8C]">
                  <span>{isUser ? 'Alex Rivera (SRE)' : 'FinSort Copilot'}</span>
                  {msg.tool && (
                    <span className="text-[10px] font-sans px-2 py-0.2 rounded-md status-green">
                      tool: {msg.tool}
                    </span>
                  )}
                  {msg.created_at && (
                    <span className="tabular-nums">{formatTime(msg.created_at)}</span>
                  )}
                </div>

                {/* Bubble Container */}
                <div
                  className={`p-4 rounded-2xl max-w-[90%] text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#111318] text-white shadow-xs'
                      : 'glass-well text-[#111318] border border-black/[0.06]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}</p>

                  {/* Structured Tool Data Card */}
                  {msg.data && typeof msg.data === 'object' && (
                    <div className="mt-3 pt-3 border-t border-black/[0.08] space-y-2">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-[#767D8C]">
                        Grounded Telemetry Payload
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(msg.data)
                          .filter(([key]) => !['resources', 'recommendations', 'inventory_resources', 'knowledge_base_nodes', 'sources', 'pricing_catalog_inr', 'active_alerts'].includes(key))
                          .slice(0, 8)
                          .map(([key, val]) => (
                          <div
                            key={key}
                            className="bg-white/80 p-2.5 rounded-lg border border-black/[0.05]"
                          >
                            <div className="text-[9px] uppercase font-sans text-[#767D8C] truncate font-semibold">
                              {key.replace(/_/g, ' ')}
                            </div>
                            <div className="text-xs font-medium text-[#111318] font-sans tabular-nums mt-0.5">
                              {renderTelemetryValue(val, key)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex flex-col items-start space-y-1.5">
              <div className="flex items-center gap-2 px-1 text-[11px] font-sans text-[#767D8C]">
                <span>FinSort Copilot</span>
                <span className="status-yellow text-[10px] px-2 py-0.2 rounded-md">
                  Analyzing TimescaleDB Telemetry...
                </span>
              </div>
              <div className="p-4 rounded-2xl glass-well text-xs text-[#767D8C] flex items-center gap-3">
                <div className="w-3.5 h-3.5 border-2 border-[#111318] border-t-transparent rounded-full animate-spin" />
                <span>Querying 85 resources &amp; running p95/p99 peak governor verification...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* QUICK PROMPT CHIPS & INPUT FORM */}
        <div className="mt-6 pt-4 border-t border-black/[0.06] space-y-3">
          {/* Suggested Prompts Carousel */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] uppercase font-sans font-semibold tracking-wider text-[#767D8C] shrink-0">
              Quick Inquiries:
            </span>
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="shrink-0 text-left text-[11px] px-3 py-1.5 rounded-xl glass-well hover:bg-black/[0.06] text-[#4A505C] hover:text-[#111318] transition-colors border border-black/[0.05]"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="relative flex items-end gap-2 bg-white/90 p-2 rounded-2xl border border-black/[0.08] shadow-xs">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about rightsizing candidates, What-If simulation, memory leaks, or p99 safety thresholds..."
              className="w-full bg-transparent px-3 py-1.5 text-xs text-[#111318] placeholder-[#767D8C] focus:outline-none resize-none leading-relaxed"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isLoading || !inputQuery.trim()}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-[#111318] hover:bg-[#232730] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              {isLoading ? 'Querying...' : 'Submit'}
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#767D8C] px-1 font-sans">
            <span>Press Enter to send · Shift+Enter for newline</span>
            <span>Grounded across TimescaleDB &amp; Go FinOps Gateway (:8080)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
