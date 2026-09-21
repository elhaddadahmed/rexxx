'use client';

import { useEffect, useState } from 'react';
import { getNotificationsAction, markNotificationAsReadAction, markAllNotificationsAsReadAction } from './actions';

interface Notification {
  notification_id: string;
  title: string;
  message: string;
  notification_type: string;
  priority: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const result = await getNotificationsAction(50);
    if (result.error) {
      setError(result.error);
    } else {
      setNotifications(result.data || []);
      setError(null);
    }
    setLoading(false);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    const result = await markNotificationAsReadAction({ notification_id: notificationId });
    if (!result.error) {
      await loadNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await markAllNotificationsAsReadAction();
    if (!result.error) {
      await loadNotifications();
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      new_shift: '🔄',
      shift_changed: '✏️',
      shift_cancelled: '❌',
      leave_approved: '✅',
      leave_rejected: '❌',
      leave_requested: '📋',
      new_document: '📄',
      document_approved: '✅',
      company_announcement: '📢',
      absence_recorded: '📌',
      overtime_alert: '⏰',
      other: '📬',
    };
    return icons[type] || '📬';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      normal: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[priority] || colors.normal;
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Benachrichtigungen werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Benachrichtigungen</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {unreadCount} ungelesen von {notifications.length} Benachrichtigungen
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Alle als gelesen markieren
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-300">Fehler: {error}</p>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Keine Benachrichtigungen</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sie haben alle Benachrichtigungen gelesen
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.notification_id}
              className={`rounded-lg border transition-all cursor-pointer ${
                notification.is_read
                  ? 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm'
              }`}
              onClick={() => !notification.is_read && handleMarkAsRead(notification.notification_id)}
            >
              <div className="p-4 flex gap-4">
                <div className="text-2xl flex-shrink-0">
                  {getNotificationIcon(notification.notification_type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3
                        className={`font-semibold ${
                          notification.is_read
                            ? 'text-gray-900 dark:text-gray-200'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {notification.title}
                      </h3>
                      <p
                        className={`mt-1 text-sm ${
                          notification.is_read
                            ? 'text-gray-600 dark:text-gray-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {notification.message}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="flex-shrink-0 mt-1">
                        <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                      {notification.priority === 'low' && 'Niedrig'}
                      {notification.priority === 'normal' && 'Normal'}
                      {notification.priority === 'high' && 'Hoch'}
                      {notification.priority === 'urgent' && 'Dringend'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(notification.created_at).toLocaleDateString('de-DE', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {notification.action_url && (
                      <a
                        href={notification.action_url}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ansehen →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
