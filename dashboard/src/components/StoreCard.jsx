import React from 'react';

export default function StoreCard({ store, onDelete }) {
    const statusClass = store.status.toLowerCase();
    const createdAt = new Date(store.created_at).toLocaleString();
    const readyAt = store.ready_at ? new Date(store.ready_at).toLocaleString() : null;

    return (
        <div className="store-card">
            <div className="store-card-header">
                <div>
                    <div className="store-name">{store.name}</div>
                    <div className="store-engine">{store.engine}</div>
                </div>
                <div className={`status-badge ${statusClass}`}>
                    <span className={`status-dot ${statusClass}`} />
                    {store.status}
                </div>
            </div>

            <div className="store-details">
                <div className="store-detail-row">
                    <span className="store-detail-label">ID</span>
                    <span className="store-detail-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {store.id}
                    </span>
                </div>
                <div className="store-detail-row">
                    <span className="store-detail-label">Namespace</span>
                    <span className="store-detail-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {store.namespace}
                    </span>
                </div>
                {store.store_url && (
                    <div className="store-detail-row">
                        <span className="store-detail-label">Store URL</span>
                        <span className="store-detail-value">
                            <a href={store.store_url} target="_blank" rel="noopener noreferrer">
                                {store.store_url}
                            </a>
                        </span>
                    </div>
                )}
                {store.admin_url && store.status === 'Ready' && (
                    <div className="store-detail-row">
                        <span className="store-detail-label">Admin URL</span>
                        <span className="store-detail-value">
                            <a href={store.admin_url} target="_blank" rel="noopener noreferrer">
                                {store.admin_url}
                            </a>
                        </span>
                    </div>
                )}
                <div className="store-detail-row">
                    <span className="store-detail-label">Created</span>
                    <span className="store-detail-value">{createdAt}</span>
                </div>
                {readyAt && (
                    <div className="store-detail-row">
                        <span className="store-detail-label">Ready at</span>
                        <span className="store-detail-value">{readyAt}</span>
                    </div>
                )}
            </div>

            {store.error_message && (
                <div className="store-error">
                    ⚠ {store.error_message}
                </div>
            )}

            <div className="store-card-actions">
                {store.store_url && store.status === 'Ready' && (
                    <a href={store.store_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        🌐 Open Store
                    </a>
                )}
                {store.admin_url && store.status === 'Ready' && (
                    <a href={store.admin_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        ⚙ Admin Panel
                    </a>
                )}
                {store.status !== 'Deleting' && (
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(store)}>
                        🗑 Delete
                    </button>
                )}
                {store.status === 'Deleting' && (
                    <span style={{ color: 'var(--status-deleting)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                        Cleaning up resources...
                    </span>
                )}
            </div>
        </div>
    );
}
