import React from 'react';

export default function MetricsBar({ metrics }) {
    if (!metrics) return null;

    return (
        <div className="metrics-bar">
            <div className="metric-card">
                <div className="metric-label">Active Stores</div>
                <div className="metric-value">{metrics.totalActive || 0}</div>
            </div>
            <div className="metric-card">
                <div className="metric-label">Ready</div>
                <div className="metric-value success">{metrics.byStatus?.Ready || 0}</div>
            </div>
            <div className="metric-card">
                <div className="metric-label">Provisioning</div>
                <div className="metric-value warning">{metrics.byStatus?.Provisioning || 0}</div>
            </div>
            <div className="metric-card">
                <div className="metric-label">Failed</div>
                <div className="metric-value error">{metrics.byStatus?.Failed || 0}</div>
            </div>
            <div className="metric-card">
                <div className="metric-label">Avg Provision Time</div>
                <div className="metric-value">
                    {metrics.avgProvisionTimeSeconds
                        ? `${Math.floor(metrics.avgProvisionTimeSeconds / 60)}m ${metrics.avgProvisionTimeSeconds % 60}s`
                        : '—'}
                </div>
            </div>
            <div className="metric-card">
                <div className="metric-label">Total Created</div>
                <div className="metric-value">{metrics.totalCreated || 0}</div>
            </div>
        </div>
    );
}
