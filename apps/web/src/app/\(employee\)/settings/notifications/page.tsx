'use client';

import { useEffect, useState } from 'react';
import { getNotificationPreferencesAction, updateNotificationPreferencesAction } from '@/app/(employee)/notifications/actions';

interface NotificationPreferences {
  new_shift_enabled: boolean;
  shift_changed_enabled: boolean;
  shift_cancelled_enabled: boolean;
  leave_approved_enabled: boolean;
  leave_rejected_enabled: boolean;
  leave_requested_enabled: boolean;
  new_document_enabled: boolean;
  document_approved_enabled: boolean;
  company_announcement_enabled: boolean;
  absence_recorded_enabled: boolean;
  overtime_alert_enabled: boolean;
  push_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    const result = await getNotificationPreferencesAction();
    if (result.error) {
      setError(result.error);
    } else {
      setPreferences(result.data);
      setError(null);
    }
    setLoading(false);
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  const handleSave = async () => {
    if (!preferences) return;
    setSaving(true);
    const result = await updateNotificationPreferencesAction(preferences);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage('Einstellungen gespeichert');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Einstellungen werden geladen...</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-300">Fehler beim Laden der Einstellungen</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Benachrichtigungseinstellungen
      </h1>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">Fehler: {error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-300">{successMessage}</p>
        </div>
      )}

      <div className="space-y-8">
        {/* Global Preferences */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Allgemeine Einstellungen
          </h2>

          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.push_notifications_enabled}
                onChange={() => handleToggle('push_notifications_enabled')}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-700 dark:text-gray-300">Push-Benachrichtigungen aktivieren</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.email_notifications_enabled}
                onChange={() => handleToggle('email_notifications_enabled')}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-700 dark:text-gray-300">E-Mail-Benachrichtigungen aktivieren</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.quiet_hours_enabled}
                onChange={() => handleToggle('quiet_hours_enabled')}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-700 dark:text-gray-300">Ruhezeitvon aktivieren</span>
            </label>

            {preferences.quiet_hours_enabled && (
              <div className="ml-8 space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Ruhezeitvon Start
                  </label>
                  <input
                    type="time"
                    value={preferences.quiet_hours_start || '22:00'}
                    onChange={(e) =>
                      setPreferences({ ...preferences, quiet_hours_start: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Ruhezeitvon Ende
                  </label>
                  <input
                    type="time"
                    value={preferences.quiet_hours_end || '08:00'}
                    onChange={(e) => setPreferences({ ...preferences, quiet_hours_end: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Notification Type Preferences */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Benachrichtigungstypen
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'new_shift_enabled', label: 'Neue Schicht' },
              { key: 'shift_changed_enabled', label: 'Schicht geändert' },
              { key: 'shift_cancelled_enabled', label: 'Schicht abgebrochen' },
              { key: 'leave_approved_enabled', label: 'Urlaub genehmigt' },
              { key: 'leave_rejected_enabled', label: 'Urlaub abgelehnt' },
              { key: 'leave_requested_enabled', label: 'Urlaubsantrag eingegangen' },
              { key: 'new_document_enabled', label: 'Neues Dokument' },
              { key: 'document_approved_enabled', label: 'Dokument genehmigt' },
              { key: 'company_announcement_enabled', label: 'Firmenmitteilung' },
              { key: 'absence_recorded_enabled', label: 'Abwesenheit erfasst' },
              { key: 'overtime_alert_enabled', label: 'Überzeit-Warnung' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences[key as keyof NotificationPreferences] as boolean}
                  onChange={() => handleToggle(key as keyof NotificationPreferences)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="ml-3 text-gray-700 dark:text-gray-300">{label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Save Button */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
          >
            {saving ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
