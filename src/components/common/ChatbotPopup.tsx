import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../api/client';
import type { ChatMessageItem } from '../../types/api';
import { formatINR } from '../../utils/format';

interface ChatbotPopupProps {
  isOpen: boolean;
  onClose: () => void;
  isAIConnected?: boolean;
  currentSpendInr?: number;
  acceptedSavingsInr?: number;
}

const QUICK_PROMPTS = [
  'What are our top 3 rightsizing candidates with projected p99 < 85%?',
  'Explain ALT-001 time-to-failure analysis and OOM risk',
  'What if we hibernate dev VMs in Bangalore from 8 PM to 8 AM?',
  'What is our 60-day unoptimized vs optimized cost trajectory?',
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

export const ChatbotPopup: React.FC<ChatbotPopupProps> = ({
  isOpen,
  onClose,
  isAIConnected = false,
  currentSpendInr = 683200,
  acceptedSavingsInr = 150310,
}) => {
  const [conversationId, setConversationId] = useState<string>(() => `popup-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessageItem[]>(() => [
    {
      role: 'assistant',
      content:
        'SmartCloud Copilot online. Grounded across all 85 Utho Cloud nodes, TimescaleDB telemetry, p95/p99 peak governors, and INR catalog pricing. Ask me anything about rightsizing, active alerts, or What-If scenarios.',
      created_at: BOOTSTRAP_TIME,
      tool: 'copilot_popup_init',
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
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages, isLoading]);

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
          'Error querying remote AI service. Local deterministic FinOps engine active: all 85 Utho resources, p99 safety rules, and INR pricing catalog remain enforced.',
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

  const handleResetSession = () => {
    const newId = `popup-${Date.now()}`;
    setConversationId(newId);
    setMessages([
      {
        role: 'assistant',
        content:
          'New session initiated. Ready to audit candidate downsizings, compute simulation impact, or analyze memory exhaustion slopes.',
        created_at: getNowIso(),
        tool: 'session_reset',
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-[430px] max-w-[94vw] h-[610px] max-h-[86vh] z-50 glass-card rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-black/[0.12] animate-in fade-in slide-in-from-bottom-5 duration-200">
      {/* POPUP HEADER */}
      <div className="p-4 border-b border-black/[0.08] bg-white/85 backdrop-blur-xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#111318] text-white flex items-center justify-center text-xs font-mono font-bold shadow-xs">
            AI
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#111318] tracking-tight">
                AI FinOps Copilot
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                  isAIConnected ? 'status-green' : 'status-yellow'
                }`}
              >
                {isAIConnected ? 'Timescale+Gemini' : 'SRE Engine'}
              </span>
            </div>
            <span className="text-[10px] text-[#767D8C] font-mono">
              Grounded in 85 Utho Nodes · p99 &lt; 85%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetSession}
            title="Reset Chat Session"
            className="p-1.5 rounded-lg glass-well hover:bg-black/[0.08] text-[#4A505C] hover:text-[#111318] text-[11px] font-mono transition-colors cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Copilot Popup"
            className="w-7 h-7 rounded-lg glass-well hover:bg-black/[0.08] text-[#111318] font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* QUICK CONTEXT STRIP */}
      <div className="px-4 py-2 bg-black/[0.02] border-b border-black/[0.05] flex items-center justify-between text-[10px] font-mono text-[#767D8C] shrink-0">
        <div>
          Spend: <span className="text-[#111318] font-semibold">{formatINR(currentSpendInr)}</span>
        </div>
        <div>
          Saved: <span className="text-[#236B52] font-semibold">{formatINR(acceptedSavingsInr)}</span>
        </div>
        <div className="text-[9px] uppercase px-1.5 py-0.5 rounded status-green font-semibold">
          Live Sync
        </div>
      </div>

      {/* MESSAGE STREAM */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={idx}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div className="flex items-center gap-1.5 px-1 text-[10px] font-mono text-[#767D8C]">
                <span>{isUser ? 'You' : 'SmartCloud Copilot'}</span>
                {msg.tool && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded status-green">
                    {msg.tool}
                  </span>
                )}
                {msg.created_at && <span>{formatTime(msg.created_at)}</span>}
              </div>

              <div
                className={`p-3 rounded-xl max-w-[88%] leading-relaxed ${
                  isUser
                    ? 'bg-[#111318] text-white shadow-xs'
                    : 'glass-well text-[#111318] border border-black/[0.06]'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.data && typeof msg.data === 'object' && (
                  <div className="mt-2 pt-2 border-t border-black/[0.08] space-y-1.5">
                    <div className="text-[9px] uppercase font-mono font-semibold text-[#767D8C]">
                      Grounded Telemetry
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(msg.data).map(([key, val]) => (
                        <div
                          key={key}
                          className="bg-white/80 p-1.5 rounded border border-black/[0.05]"
                        >
                          <div className="text-[8px] uppercase font-mono text-[#767D8C] truncate">
                            {key.replace(/_/g, ' ')}
                          </div>
                          <div className="text-[11px] font-semibold text-[#111318] font-mono mt-0.5 truncate">
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
          <div className="flex flex-col items-start space-y-1">
            <span className="text-[10px] font-mono text-[#767D8C] px-1">SmartCloud Copilot</span>
            <div className="p-3 rounded-xl glass-well text-xs text-[#767D8C] flex items-center gap-2 border border-black/[0.06]">
              <div className="w-3 h-3 border-2 border-[#111318] border-t-transparent rounded-full animate-spin" />
              <span>Analyzing TimescaleDB telemetry...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* QUICK PROMPT CHIPS */}
      <div className="px-3 pt-2 pb-1 border-t border-black/[0.05] bg-white/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="shrink-0 text-left text-[10px] px-2.5 py-1 rounded-lg glass-well hover:bg-black/[0.06] text-[#4A505C] hover:text-[#111318] transition-colors border border-black/[0.05] cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* INPUT FORM */}
      <div className="p-3 border-t border-black/[0.08] bg-white/95 backdrop-blur-xl shrink-0 space-y-1.5">
        <div className="relative flex items-end gap-2 bg-black/[0.03] p-1.5 rounded-xl border border-black/[0.07]">
          <textarea
            ref={inputRef}
            rows={2}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about rightsizing, What-If scenarios, memory leak TTF..."
            className="w-full bg-transparent px-2.5 py-1 text-xs text-[#111318] placeholder-[#767D8C] focus:outline-none resize-none leading-relaxed"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isLoading || !inputQuery.trim()}
            className="shrink-0 px-3.5 py-2 rounded-lg bg-[#111318] hover:bg-[#232730] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>

        <div className="flex items-center justify-between text-[9px] text-[#767D8C] px-1 font-mono">
          <span>Enter to send · Shift+Enter newline</span>
          <span>TimescaleDB &amp; Gateway (:8080)</span>
        </div>
      </div>
    </div>
  );
};
