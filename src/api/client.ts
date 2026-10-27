import type {
  Resource,
  ResourceDetail,
  Recommendation,
  DashboardResponse,
  RecommendationsResponse,
  SimulationParams,
  SimulationResult,
  AnomalyAlert,
  AssumptionsResponse,
  RemediationExport,
  NLScenarioResponse,
  AIForecastResponse,
  AIBriefingResponse,
  ChatResponse,
  ChatHistoryResponse,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  async checkConnection(): Promise<{ isConnected: boolean; goConnected: boolean; aiConnected: boolean; llmConfigured?: boolean; googleModel?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { isConnected: false, goConnected: false, aiConnected: false };
      const data = await res.json().catch(() => ({}));
      return {
        isConnected: true,
        goConnected: true,
        aiConnected: Boolean(data.ai_engine_connected ?? data.aiConnected ?? true),
        llmConfigured: Boolean(data.llm_configured),
        googleModel: data.google_model,
      };
    } catch {
      return { isConnected: false, goConnected: false, aiConnected: false };
    }
  },

  async checkLLMHealth(): Promise<{
    status: string;
    api_key_configured: boolean;
    masked_key?: string;
    live_call_success: boolean;
    active_model?: string;
    sample_response?: string;
    latency_ms?: number;
    error?: string;
  }> {
    return fetchJSON(`${BASE_URL}/ai/llm-health`);
  },

  async checkServiceStatus(): Promise<{ isConnected: boolean; goConnected: boolean; aiConnected: boolean; llmConfigured?: boolean; googleModel?: string }> {
    return this.checkConnection();
  },

  async getDashboard(): Promise<DashboardResponse> {
    return fetchJSON<DashboardResponse>(`${BASE_URL}/dashboard`);
  },

  async getResources(): Promise<Resource[]> {
    return fetchJSON<Resource[]>(`${BASE_URL}/resources`);
  },

  async getResource(id: string): Promise<ResourceDetail> {
    return fetchJSON<ResourceDetail>(`${BASE_URL}/resources/${encodeURIComponent(id)}`);
  },

  async getRecommendations(): Promise<RecommendationsResponse> {
    return fetchJSON<RecommendationsResponse>(`${BASE_URL}/recommendations`);
  },

  async patchRecommendation(id: string, status: 'accepted' | 'rejected' | 'pending'): Promise<Recommendation> {
    return fetchJSON<Recommendation>(`${BASE_URL}/recommendations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async bulkRecommendations(
    status: 'accepted' | 'rejected' | 'pending',
    scope?: string
  ): Promise<RecommendationsResponse> {
    return fetchJSON<RecommendationsResponse>(`${BASE_URL}/recommendations/bulk`, {
      method: 'POST',
      body: JSON.stringify({ status, scope: scope || 'ALL' }),
    });
  },

  async getAlerts(): Promise<AnomalyAlert[]> {
    return fetchJSON<AnomalyAlert[]>(`${BASE_URL}/alerts`);
  },

  async getAssumptions(): Promise<AssumptionsResponse> {
    return fetchJSON<AssumptionsResponse>(`${BASE_URL}/assumptions`);
  },

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    return fetchJSON<SimulationResult>(`${BASE_URL}/simulate`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async parseNLScenario(query: string): Promise<NLScenarioResponse> {
    return fetchJSON<NLScenarioResponse>(`${BASE_URL}/ai/parse-scenario`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },

  async getAIForecast(
    days = 30,
    headroom = 1.30,
    acceptedSavingsInr = 0
  ): Promise<AIForecastResponse> {
    return fetchJSON<AIForecastResponse>(`${BASE_URL}/ai/forecast`, {
      method: 'POST',
      body: JSON.stringify({
        days,
        headroom,
        accepted_savings_inr: acceptedSavingsInr,
        accepted_savings_inr_per_month: acceptedSavingsInr,
      }),
    });
  },

  async getRoleBriefing(role = 'SRE'): Promise<AIBriefingResponse> {
    return fetchJSON<AIBriefingResponse>(`${BASE_URL}/ai/briefing`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  async getAIBriefing(role = 'SRE'): Promise<AIBriefingResponse> {
    return this.getRoleBriefing(role);
  },

  async chat(message: string, conversationId = 'default'): Promise<ChatResponse> {
    return fetchJSON<ChatResponse>(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, conversation_id: conversationId }),
    });
  },

  async sendChatMessage(message: string, conversationId = 'default'): Promise<ChatResponse> {
    return this.chat(message, conversationId);
  },

  async getChatHistory(conversationId: string): Promise<ChatHistoryResponse> {
    return fetchJSON<ChatHistoryResponse>(`${BASE_URL}/ai/chat/${encodeURIComponent(conversationId)}`);
  },

  async exportRemediation(format: 'json' | 'csv' | 'markdown' = 'markdown'): Promise<RemediationExport> {
    try {
      return await fetchJSON<RemediationExport>(
        `${BASE_URL}/export/remediation?format=${encodeURIComponent(format)}`
      );
    } catch {
      return fetchJSON<RemediationExport>(`${BASE_URL}/export?format=${encodeURIComponent(format)}`);
    }
  },

  async getRemediationExport(format: 'json' | 'csv' | 'markdown' = 'markdown'): Promise<RemediationExport> {
    return this.exportRemediation(format);
  },
};
