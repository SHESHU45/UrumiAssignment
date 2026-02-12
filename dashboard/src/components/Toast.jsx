import React from 'react';

export default function Toast({ toasts }) {
    if (!toasts || toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast ${toast.type}`}>
                    {toast.type === 'error' && '❌ '}
                    {toast.type === 'success' && '✅ '}
                    {toast.type === 'info' && 'ℹ️ '}
                    {toast.message}
                </div>
            ))}
        </div>
    );
}
