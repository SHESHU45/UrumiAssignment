import React from 'react';

export default function EventsPanel({ events }) {
    if (!events || events.length === 0) {
        return (
            <div className="panel">
                <div className="panel-header">
                    <h3 className="panel-title">Activity Log</h3>
                </div>
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                    <div className="empty-state-icon" style={{ fontSize: '2.5rem' }}>📋</div>
                    <p style={{ color: 'var(--text-muted)' }}>No activity yet. Create a store to see events here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h3 className="panel-title">Activity Log</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                    {events.length} events
                </span>
            </div>
            <div className="events-list">
                {events.map((event) => (
                    <div key={event.id} className="event-item">
                        <span className={`event-badge ${event.event_type}`} />
                        <span className="event-time">
                            {new Date(event.created_at).toLocaleString()}
                        </span>
                        <span className="event-message">{event.message}</span>
                        {event.store_id && (
                            <span className="event-store">{event.store_id}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
