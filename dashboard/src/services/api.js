const API_BASE = '/api';

async function request(url, options = {}) {
    const response = await fetch(`${API_BASE}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    return data;
}

export const api = {
    // Stores
    listStores: () => request('/stores'),
    createStore: (name, engine = 'woocommerce') =>
        request('/stores', {
            method: 'POST',
            body: JSON.stringify({ name, engine }),
        }),
    getStore: (id) => request(`/stores/${id}`),
    deleteStore: (id) => request(`/stores/${id}`, { method: 'DELETE' }),

    // Events
    getStoreEvents: (id) => request(`/stores/${id}/events`),
    getAllEvents: (limit = 100) => request(`/events?limit=${limit}`),

    // Metrics
    getMetrics: () => request('/metrics'),

    // Audit
    getAuditLog: (limit = 100) => request(`/audit-log?limit=${limit}`),

    // Health
    health: () => request('/health'),
};
