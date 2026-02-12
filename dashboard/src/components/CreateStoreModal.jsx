import React, { useState } from 'react';

export default function CreateStoreModal({ onSubmit, onClose }) {
    const [name, setName] = useState('');
    const [engine, setEngine] = useState('woocommerce');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedName = name.trim().toLowerCase();
        if (!trimmedName) {
            setError('Store name is required');
            return;
        }
        if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(trimmedName)) {
            setError('Name must be DNS-safe: lowercase letters, numbers, and hyphens (1-63 chars)');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(trimmedName, engine);
        } catch (err) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 className="modal-title">Create New Store</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="store-name">Store Name</label>
                        <input
                            id="store-name"
                            className="form-input"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="my-awesome-store"
                            autoFocus
                            disabled={submitting}
                            maxLength={63}
                        />
                        <div className="form-hint">
                            DNS-safe name (lowercase, hyphens allowed). Used in the store URL.
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="store-engine">Store Engine</label>
                        <select
                            id="store-engine"
                            className="form-select"
                            value={engine}
                            onChange={e => setEngine(e.target.value)}
                            disabled={submitting}
                        >
                            <option value="woocommerce">🛒 WooCommerce (WordPress)</option>
                            <option value="medusa" disabled>🟣 MedusaJS (Coming Soon)</option>
                        </select>
                        <div className="form-hint">
                            WooCommerce deploys WordPress + MySQL with the WooCommerce plugin pre-configured.
                        </div>
                    </div>

                    {error && (
                        <div className="confirm-warning">{error}</div>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <span className="loading-spinner" style={{ width: 16, height: 16 }} />
                                    Provisioning...
                                </>
                            ) : (
                                '🚀 Create Store'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
