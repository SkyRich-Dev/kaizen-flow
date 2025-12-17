const API_BASE = '/api';

export interface ApiError {
  message: string;
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function transformKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(transformKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      acc[snakeToCamel(key)] = transformKeys(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const tokens = localStorage.getItem('kaizen_tokens');
  if (tokens) {
    const parsed = JSON.parse(tokens);
    headers['Authorization'] = `Bearer ${parsed.access}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response, skipRedirectOn401 = false): Promise<T> {
  if (!response.ok) {
    if (response.status === 401 && !skipRedirectOn401) {
      localStorage.removeItem('kaizen_tokens');
      localStorage.removeItem('kaizen_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || error.detail || error.error || 'An error occurred');
  }
  return response.json();
}

export const authApi = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<{ user: any; tokens: { access: string; refresh: string } }>(response);
    localStorage.setItem('kaizen_tokens', JSON.stringify(data.tokens));
    localStorage.setItem('kaizen_user', JSON.stringify(data.user));
    return { user: data.user };
  },

  logout: async () => {
    const tokens = localStorage.getItem('kaizen_tokens');
    if (tokens) {
      try {
        const parsed = JSON.parse(tokens);
        await fetch(`${API_BASE}/auth/logout/`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ refresh: parsed.refresh }),
        });
      } catch (e) {
        // Ignore errors during logout
      }
    }
    localStorage.removeItem('kaizen_tokens');
    localStorage.removeItem('kaizen_user');
    return { message: 'Logged out' };
  },

  getCurrentUser: async () => {
    const response = await fetch(`${API_BASE}/auth/me/`, {
      headers: getAuthHeaders(),
    });
    const user = await handleResponse<any>(response, true);
    return { user };
  },
};

export const departmentsApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/departments/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },
};

export const requestsApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/kaizen/`, {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse<any[]>(response);
    return transformKeys(data);
  },

  getById: async (id: number) => {
    const response = await fetch(`${API_BASE}/kaizen/${id}/`, {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse<any>(response);
    return transformKeys(data);
  },

  getByRequestId: async (requestId: string) => {
    const response = await fetch(`${API_BASE}/kaizen/by-request-id/${encodeURIComponent(requestId)}/`, {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse<any>(response);
    return transformKeys(data);
  },

  create: async (data: any) => {
    const response = await fetch(`${API_BASE}/kaizen/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  update: async (id: number, data: any) => {
    const response = await fetch(`${API_BASE}/kaizen/${id}/`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  getPending: async () => {
    const response = await fetch(`${API_BASE}/kaizen/pending/`, {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse<any[]>(response);
    return transformKeys(data);
  },

  getMy: async () => {
    const response = await fetch(`${API_BASE}/kaizen/my/`, {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse<any[]>(response);
    return transformKeys(data);
  },
};

export const hodApi = {
  submitOwnHodDecision: async (requestId: string, data: { decision: 'APPROVED' | 'REJECTED'; remarks?: string; answers?: any[] }) => {
    const response = await fetch(`${API_BASE}/approvals/kaizen/by-request-id/${encodeURIComponent(requestId)}/own-hod/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  submitCrossHodDecision: async (requestId: string, data: { decision: 'APPROVED' | 'REJECTED'; remarks?: string; answers?: any[] }) => {
    const response = await fetch(`${API_BASE}/approvals/kaizen/by-request-id/${encodeURIComponent(requestId)}/cross-hod/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },
};

export const managerApi = {
  submitOwnManagerDecision: async (requestId: string, data: { decision: 'APPROVED' | 'REJECTED'; remarks?: string; answers?: any[] }) => {
    const response = await fetch(`${API_BASE}/approvals/kaizen/by-request-id/${encodeURIComponent(requestId)}/own-manager/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  submitCrossManagerDecision: async (requestId: string, data: { decision: 'APPROVED' | 'REJECTED'; remarks?: string; answers?: any[] }) => {
    const response = await fetch(`${API_BASE}/approvals/kaizen/by-request-id/${encodeURIComponent(requestId)}/manager/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },
};

export const evaluationApi = {
  submitEvaluation: async (requestId: string, data: { 
    answers: Array<{ questionKey: string; answer: 'YES' | 'NO'; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; remarks: string }>;
    decision: 'APPROVED' | 'REJECTED';
    remarks?: string;
  }) => {
    const stored = localStorage.getItem('kaizen_user');
    const user = stored ? JSON.parse(stored) : null;
    const endpoint = user?.role === 'MANAGER' ? 'manager' : 'cross-hod';
    
    const response = await fetch(`${API_BASE}/approvals/kaizen/by-request-id/${encodeURIComponent(requestId)}/${endpoint}/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  getEvaluations: async (requestId: string) => {
    const response = await fetch(`${API_BASE}/kaizen/by-request-id/${encodeURIComponent(requestId)}/`, {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse<any>(response);
    return data.department_evaluations || [];
  },
};

export const approvalsApi = {
  submitAgmDecision: async (requestId: string, data: { approved: boolean; comments?: string; cost_justification?: string }) => {
    const response = await fetch(`${API_BASE}/approvals/kaizen/by-request-id/${encodeURIComponent(requestId)}/agm/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  submitGmDecision: async (requestId: string, data: { approved: boolean; comments?: string; cost_justification?: string }) => {
    const response = await fetch(`${API_BASE}/approvals/kaizen/by-request-id/${encodeURIComponent(requestId)}/gm/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },
};

export const settingsApi = {
  get: async () => {
    const response = await fetch(`${API_BASE}/audit/settings/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  update: async (data: any) => {
    // Django expects individual key/value pairs - flatten nested objects
    const flattenSettings = (obj: any, prefix = ''): Array<{key: string, value: any}> => {
      const result: Array<{key: string, value: any}> = [];
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          result.push(...flattenSettings(v, key));
        } else {
          result.push({ key, value: v });
        }
      }
      return result;
    };
    
    const pairs = flattenSettings(data);
    const responses = await Promise.all(
      pairs.map(({ key, value }) =>
        fetch(`${API_BASE}/audit/settings/update/`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ key, value }),
        })
      )
    );
    
    for (const response of responses) {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update settings' }));
        throw new Error(error.message || error.error || 'Failed to update settings');
      }
    }
    
    return { message: 'Settings updated successfully' };
  },
};

export const usersApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/auth/users/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  create: async (data: any) => {
    const response = await fetch(`${API_BASE}/auth/users/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  update: async (id: number, data: any) => {
    const response = await fetch(`${API_BASE}/auth/users/${id}/`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },
};

export const auditApi = {
  getLogs: async (requestId?: string) => {
    const url = requestId 
      ? `${API_BASE}/audit/logs/?request_id=${requestId}`
      : `${API_BASE}/audit/logs/`;
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },
};

export const reportsApi = {
  getDashboard: async () => {
    const response = await fetch(`${API_BASE}/reports/dashboard/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getMyRequests: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/my-requests/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  getDepartmentSummary: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/department-summary/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  getEvaluationDetails: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/evaluation-details/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  getRiskHeatmap: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/risk-heatmap/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getCrossDeptStatus: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/cross-dept-status/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  getRejectionAnalysis: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/rejection-analysis/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getPipeline: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/pipeline/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getCostImpact: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/cost-impact/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getBudget: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/budget/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getManpowerProcess: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/manpower-process/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getHighRisk: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/high-risk/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  getCompliance: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/compliance/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getAuditTrail: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/audit-trail/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  getSlaDelay: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/sla-delay/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getTat: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/tat/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  getNotifications: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/notifications/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  getUserActivity: async (params?: Record<string, string>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE}/reports/user-activity/${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  exportCsv: (reportType: string, params?: Record<string, string>) => {
    const allParams = { ...params, export: 'csv' };
    const queryString = '?' + new URLSearchParams(allParams).toString();
    const tokens = localStorage.getItem('kaizen_tokens');
    if (tokens) {
      const parsed = JSON.parse(tokens);
      window.open(`${API_BASE}/reports/${reportType}/${queryString}&token=${parsed.access}`, '_blank');
    }
  },
};

export const notificationSettingsApi = {
  get: async () => {
    const response = await fetch(`${API_BASE}/audit/settings/notifications/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<{
      email: { enabled: boolean; config: any; updated_at: string; updated_by: string | null };
      whatsapp: { enabled: boolean; config: any; updated_at: string; updated_by: string | null };
    }>(response);
  },

  saveEmail: async (data: { enabled: boolean; config: any }) => {
    const response = await fetch(`${API_BASE}/audit/settings/notifications/email/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  saveWhatsApp: async (data: { enabled: boolean; config: any }) => {
    const response = await fetch(`${API_BASE}/audit/settings/notifications/whatsapp/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  testEmail: async (toEmail: string) => {
    const response = await fetch(`${API_BASE}/audit/settings/notifications/test/email/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ to_email: toEmail }),
    });
    return handleResponse<any>(response);
  },

  testWhatsApp: async (toNumber: string) => {
    const response = await fetch(`${API_BASE}/audit/settings/notifications/test/whatsapp/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ to_number: toNumber }),
    });
    return handleResponse<any>(response);
  },
};
