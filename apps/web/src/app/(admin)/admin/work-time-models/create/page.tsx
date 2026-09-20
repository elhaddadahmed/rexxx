'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { createWorkTimeModelAction } from '../actions';
import { useAuth } from '@/hooks/useAuth';

export default function CreateWorkTimeModelPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    model_type: 'full_time' as const,
    description: '',
    weekly_hours: 40,
    daily_hours: 8,
    work_days_per_week: 5,
    break_duration: 30,
    rounding: 15,
    allows_night_work: false,
    allows_sunday_work: false,
    core_hours_start: '',
    core_hours_end: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!user) {
      setError('Nicht authentifiziert');
      setLoading(false);
      return;
    }

    try {
      const result = await createWorkTimeModelAction(
        {
          ...formData,
          core_hours_start: formData.core_hours_start || undefined,
          core_hours_end: formData.core_hours_end || undefined,
        },
        user.id,
      );

      if (!result.success) {
        setError(result.error || 'Fehler beim Erstellen');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/work-time-models');
      }, 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Neues Arbeitszeitmodell</h1>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
          ✅ Modell erfolgreich erstellt. Weiterleitung...
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Basic Info */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold mb-4">Grundinfos</h2>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
              placeholder="z.B. Vollzeit, Teilzeit 50%"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="model_type" className="block text-sm font-medium mb-1">
                Typ *
              </label>
              <select
                id="model_type"
                value={formData.model_type}
                onChange={(e) => setFormData({ ...formData, model_type: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="full_time">Vollzeit</option>
                <option value="part_time">Teilzeit</option>
                <option value="flexible">Flexibel</option>
                <option value="shift">Schicht</option>
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Beschreibung
              </label>
              <input
                id="description"
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                placeholder="z.B. Standard Vollzeitposition"
              />
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold mb-4">Arbeitszeiten</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="weekly_hours" className="block text-sm font-medium mb-1">
                Soll-Wochenstunden *
              </label>
              <input
                id="weekly_hours"
                type="number"
                step="0.5"
                value={formData.weekly_hours}
                onChange={(e) => setFormData({ ...formData, weekly_hours: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="daily_hours" className="block text-sm font-medium mb-1">
                Tagesstunden *
              </label>
              <input
                id="daily_hours"
                type="number"
                step="0.5"
                value={formData.daily_hours}
                onChange={(e) => setFormData({ ...formData, daily_hours: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="work_days_per_week" className="block text-sm font-medium mb-1">
                Arbeitstage/Woche *
              </label>
              <input
                id="work_days_per_week"
                type="number"
                min="1"
                max="7"
                value={formData.work_days_per_week}
                onChange={(e) => setFormData({ ...formData, work_days_per_week: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="break_duration" className="block text-sm font-medium mb-1">
                Pausendauer (Minuten)
              </label>
              <input
                id="break_duration"
                type="number"
                min="0"
                max="480"
                value={formData.break_duration}
                onChange={(e) => setFormData({ ...formData, break_duration: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="rounding" className="block text-sm font-medium mb-1">
                Rundung (Minuten)
              </label>
              <select
                id="rounding"
                value={formData.rounding}
                onChange={(e) => setFormData({ ...formData, rounding: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="1">1 Minute</option>
                <option value="5">5 Minuten</option>
                <option value="15">15 Minuten</option>
                <option value="30">30 Minuten</option>
                <option value="60">1 Stunde</option>
              </select>
            </div>
          </div>
        </div>

        {/* Special Rules */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold mb-4">Spezialregeln</h2>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.allows_night_work}
                onChange={(e) => setFormData({ ...formData, allows_night_work: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
                disabled={loading}
              />
              <span className="text-sm">Nachtarbeit erlaubt</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.allows_sunday_work}
                onChange={(e) => setFormData({ ...formData, allows_sunday_work: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
                disabled={loading}
              />
              <span className="text-sm">Sonntagsarbeit erlaubt</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="core_hours_start" className="block text-sm font-medium mb-1">
                Kernzeit Start (optional)
              </label>
              <input
                id="core_hours_start"
                type="time"
                value={formData.core_hours_start}
                onChange={(e) => setFormData({ ...formData, core_hours_start: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="core_hours_end" className="block text-sm font-medium mb-1">
                Kernzeit Ende (optional)
              </label>
              <input
                id="core_hours_end"
                type="time"
                value={formData.core_hours_end}
                onChange={(e) => setFormData({ ...formData, core_hours_end: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
            disabled={loading}
          >
            {loading ? 'Wird erstellt...' : 'Erstellen'}
          </button>
          <Link
            href="/admin/work-time-models"
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 py-2 rounded-md font-medium text-center transition"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
