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
  'What are our top 3 rightsizing candidates with projected p99 < 85%?',
  'Explain ALT-001 time-to-failure analysis and OOM risk',
  'What if we hibernate dev VMs in Bangalore from 8 PM to 8 AM?',
  'What is our 60-day unoptimized vs optimized cost trajectory?',
  'Generate an executive briefing for cloud spend optimization',
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

export const CopilotView: React.FC<CopilotViewProps> = ({
  isAIConnected = false,
  onInspectResource: _onInspectResource,
}) => {
  const [conversationId, setConversationId] = useState<string>(() => `conv-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessageItem[]>(() => [
    {
      role: 'assistant',
      content:
        'SmartCloud Copilot online. Grounded across all 85 Utho Cloud resources, TimescaleDB time-series telemetry, p95/p99 peak safety governors, and Indian Rupee (₹) pricing catalog. How can I assist your FinOps or SRE review today?',
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
              <span className="w-2.5 h-2.5 rounded-full bg-[#236B52] shadow-xs" />
              <h2 className="text-lg font-semibold text-[#111318] tracking-tight">
                AI FinOps &amp; SRE Copilot
              </h2>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                  isAIConnected ? 'status-green' : 'status-yellow'
                }`}
              >
                {isAIConnected ? 'TimescaleDB + Gemini Live' : 'Deterministic SRE Mode'}
              </span>
            </div>
            <p className="text-xs text-[#767D8C]">
              Continuous reasoning over 85 Utho resources, p95/p99 telemetry, peak safety governors, and ₹ INR pricing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="glass-well px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono text-[#4A505C]">
              <span className="text-[10px] text-[#767D8C] uppercase tracking-wider">Session:</span>
              <span className="text-[#111318] font-semibold">{conversationId.slice(0, 14)}...</span>
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
            <div className="text-[10px] text-[#767D8C] font-mono mt-0.5">Noida · Blr · Mumbai</div>
          </div>

          <div className="glass-well p-3 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-[#767D8C] font-semibold">
              Time-Series DB
            </div>
            <div className="text-sm font-semibold text-[#111318] mt-0.5">TimescaleDB PG16</div>
            <div className="text-[10px] text-[#236B52] font-mono mt-0.5">Hypertables Synced</div>
          </div>

          <div className="glass-well p-3 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-[#767D8C] font-semibold">
              Peak Safety
            </div>
            <div className="text-sm font-semibold text-[#111318] mt-0.5">p95/p99 Governor</div>
            <div className="text-[10px] text-[#111318] font-mono mt-0.5">Projected p99 &lt; 85%</div>
          </div>

          <div className="glass-well p-3 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-[#767D8C] font-semibold">
              Currencies &amp; SLA
            </div>
            <div className="text-sm font-semibold text-[#111318] mt-0.5">₹ Indian Rupee</div>
            <div className="text-[10px] text-[#236B52] font-mono mt-0.5">Zero Downtime Risk</div>
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
                <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-[#767D8C]">
                  <span>{isUser ? 'Alex Rivera (DevSecOps)' : 'SmartCloud Copilot'}</span>
                  {msg.tool && (
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded-md status-green">
                      tool: {msg.tool}
                    </span>
                  )}
                  {msg.created_at && (
                    <span>{formatTime(msg.created_at)}</span>
                  )}
                </div>

                {/* Bubble Container */}
                <div
                  className={`p-4 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#111318] text-white shadow-xs'
                      : 'glass-well text-[#111318] border border-black/[0.06]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Structured Tool Data Card */}
                  {msg.data && typeof msg.data === 'object' && (
                    <div className="mt-3 pt-3 border-t border-black/[0.08] space-y-2">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-[#767D8C]">
                        Grounded Telemetry Payload
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(msg.data).map(([key, val]) => (
                          <div
                            key={key}
                            className="bg-white/80 p-2 rounded-lg border border-black/[0.05]"
                          >
                            <div className="text-[9px] uppercase font-mono text-[#767D8C] truncate">
                              {key.replace(/_/g, ' ')}
                            </div>
                            <div className="text-xs font-semibold text-[#111318] font-mono mt-0.5 truncate">
                              {typeof val === 'number' && key.includes('inr')
                                ? formatINR(val)
                                : String(val)}
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
              <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-[#767D8C]">
                <span>SmartCloud Copilot</span>
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
            <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-[#767D8C] shrink-0">
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

          <div className="flex items-center justify-between text-[10px] text-[#767D8C] px-1 font-mono">
            <span>Press Enter to send · Shift+Enter for newline</span>
            <span>Grounded across TimescaleDB &amp; Go FinOps Gateway (:8080)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
