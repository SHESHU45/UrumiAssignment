import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import StoreCard from './components/StoreCard';
import CreateStoreModal from './components/CreateStoreModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import MetricsBar from './components/MetricsBar';
import EventsPanel from './components/EventsPanel';
import Toast from './components/Toast';

export default function App() {
    const [stores, setStores] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [activeTab, setActiveTab] = useState('stores');

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const [storesRes, metricsRes, eventsRes] = await Promise.all([
                api.listStores(),
                api.getMetrics(),
                api.getAllEvents(50),
            ]);
            setStores(storesRes.stores);
            setMetrics(metricsRes.metrics);
            setEvents(eventsRes.events);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleCreateStore = async (name, engine) => {
        try {
            await api.createStore(name, engine);
            addToast(`Store "${name}" creation started!`, 'success');
            setShowCreateModal(false);
            fetchData();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleDeleteStore = async (storeId) => {
        try {
            await api.deleteStore(storeId);
            addToast('Store deletion initiated', 'success');
            setDeleteTarget(null);
            fetchData();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    return (
        <div className="app">
            {/* Header */}
            <header className="header">
                <div className="header-inner">
                    <div className="logo">
                        <div className="logo-icon">S</div>
                        <div className="logo-text">
                            Store<span>Platform</span>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        + Create New Store
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">
                {/* Metrics */}
                <MetricsBar metrics={metrics} />

                {/* Tabs */}
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'stores' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stores')}
                    >
                        Stores
                    </button>
                    <button
                        className={`tab ${activeTab === 'events' ? 'active' : ''}`}
                        onClick={() => setActiveTab('events')}
                    >
                        Activity Log
                    </button>
                </div>

                {activeTab === 'stores' && (
                    <>
                        <div className="action-bar">
                            <h2 className="section-title">Your Stores</h2>
                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                {stores.length} store{stores.length !== 1 ? 's' : ''} • Auto-refreshes every 5s
                            </span>
                        </div>

                        {loading ? (
                            <div className="loading-container">
                                <div className="loading-spinner" />
                                <span>Loading stores...</span>
                            </div>
                        ) : stores.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">🏪</div>
                                <h3 className="empty-state-title">No stores yet</h3>
                                <p className="empty-state-text">
                                    Click "Create New Store" to provision your first Kubernetes-orchestrated ecommerce store.
                                </p>
                                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                                    + Create Your First Store
                                </button>
                            </div>
                        ) : (
                            <div className="store-grid">
                                {stores.map(store => (
                                    <StoreCard
                                        key={store.id}
                                        store={store}
                                        onDelete={(store) => setDeleteTarget(store)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'events' && (
                    <EventsPanel events={events} />
                )}
            </main>

            {/* Modals */}
            {showCreateModal && (
                <CreateStoreModal
                    onSubmit={handleCreateStore}
                    onClose={() => setShowCreateModal(false)}
                />
            )}

            {deleteTarget && (
                <DeleteConfirmModal
                    store={deleteTarget}
                    onConfirm={() => handleDeleteStore(deleteTarget.id)}
                    onClose={() => setDeleteTarget(null)}
                />
            )}

            {/* Toasts */}
            <Toast toasts={toasts} />
        </div>
    );
}
