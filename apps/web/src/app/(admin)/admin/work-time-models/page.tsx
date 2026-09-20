'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import type { Database } from '@novaro/shared-types';

type WorkTimeModel = Database['public']['Tables']['work_time_models']['Row'];

export default function WorkTimeModelsPage() {
  const { user, profile } = useAuth();
  const [models, setModels] = useState<WorkTimeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile) return;

    const fetchModels = async () => {
      try {
        const client = createClient();

        const { data, error: fetchError } = await client
          .from('work_time_models')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('name');

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        setModels(data || []);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [user, profile]);

  const getModelTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      full_time: 'Vollzeit',
      part_time: 'Teilzeit',
      flexible: 'Flexibel',
      shift: 'Schicht',
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Arbeitszeitmodelle</h1>
        <Link
          href="/admin/work-time-models/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition"
        >
          + Neues Modell
        </Link>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

      {loading ? (
        <div className="text-center py-8 text-gray-600">Wird geladen...</div>
      ) : models.length === 0 ? (
        <div className="text-center py-8 text-gray-600">Keine Arbeitszeitmodelle vorhanden</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Typ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Wochenstunden</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Arbeitstage/Woche</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{model.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{getModelTypeLabel(model.model_type)}</td>
                  <td className="px-6 py-4 text-sm">{model.weekly_hours}h</td>
                  <td className="px-6 py-4 text-sm">{model.work_days_per_week} Tage</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        model.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {model.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-2">
                    <Link
                      href={`/admin/work-time-models/${model.id}/edit`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Bearbeiten
                    </Link>
                    {model.is_active && (
                      <button className="text-red-600 hover:text-red-700">Deaktivieren</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
