import React, { useState } from 'react';

export default function DeleteConfirmModal({ store, onConfirm, onClose }) {
    const [confirming, setConfirming] = useState(false);

    const handleConfirm = async () => {
        setConfirming(true);
        try {
            await onConfirm();
        } catch {
            setConfirming(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 className="modal-title">Delete Store</h2>
                <p className="confirm-text">
                    Are you sure you want to delete <strong>"{store.name}"</strong>?
                </p>
                <div className="confirm-warning">
                    ⚠ This will permanently remove all resources including:
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                        <li>Kubernetes namespace ({store.namespace})</li>
                        <li>All pods, deployments, and services</li>
                        <li>Database and persistent volumes</li>
                        <li>Ingress rules and secrets</li>
                    </ul>
                    This action cannot be undone.
                </div>
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onClose} disabled={confirming}>
                        Cancel
                    </button>
                    <button className="btn btn-danger" onClick={handleConfirm} disabled={confirming}>
                        {confirming ? (
                            <>
                                <span className="loading-spinner" style={{ width: 16, height: 16 }} />
                                Deleting...
                            </>
                        ) : (
                            '🗑 Delete Store'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
