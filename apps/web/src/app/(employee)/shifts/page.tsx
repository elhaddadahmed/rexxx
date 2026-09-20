'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import { getEmployeeShiftsAction } from './actions';
import type { Database } from '@novaro/shared-types';

type Shift = Database['public']['Tables']['shift_assignments']['Row'];

export default function EmployeeShiftsPage() {
  const { user, profile } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!user) return;
    loadShifts();
  }, [user, month, year]);

  const loadShifts = async () => {
    try {
      setLoading(true);
      const client = createClient();

      // Get employee ID
      const { data: empData } = await client
        .from('employee_details')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!empData) return;

      // Get first and last day of month
      const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

      const result = await getEmployeeShiftsAction(empData.id, firstDay, lastDay);

      if (result.error) {
        setError(result.error);
        return;
      }

      setShifts(result.data || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const months = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ];

  const upcomingShifts = shifts.filter((s) => new Date(s.assigned_date) >= new Date());
  const pastShifts = shifts.filter((s) => new Date(s.assigned_date) < new Date());

  if (loading) {
    return <div className="text-center py-8">Wird geladen...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Meine Schichten</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Month/Year Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 items-center">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((m, idx) => (
              <option key={idx} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Upcoming Shifts */}
      {upcomingShifts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Anstehende Schichten</h2>
          <div className="space-y-3">
            {upcomingShifts.map((shift) => (
              <div key={shift.assignment_id} className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{shift.shift_name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {new Date(shift.assigned_date).toLocaleDateString('de-DE', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="text-sm text-gray-600">
                      ⏰ {shift.start_time} - {shift.end_time}
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      shift.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {shift.status === 'confirmed' ? 'Bestätigt' : 'Geplant'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <button className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    Tausch anfordern
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Shifts */}
      {pastShifts.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Abgelaufene Schichten</h2>
          <div className="space-y-3">
            {pastShifts.map((shift) => (
              <div key={shift.assignment_id} className="bg-gray-50 rounded-lg shadow p-4 border-l-4 border-gray-300">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{shift.shift_name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {new Date(shift.assigned_date).toLocaleDateString('de-DE', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="text-sm text-gray-600">
                      ⏰ {shift.start_time} - {shift.end_time}
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                    {shift.status === 'completed' ? 'Abgeschlossen' : 'Abgelaufen'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {shifts.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
          Keine Schichten für diesen Zeitraum geplant
        </div>
      )}
    </div>
  );
}
