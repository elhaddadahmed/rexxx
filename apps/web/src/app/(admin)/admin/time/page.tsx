'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import { correctTimeEntryAction, getMonthlyTimeEntriesAction } from './actions';
import type { Database } from '@novaro/shared-types';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
type Employee = Database['public']['Tables']['employee_details']['Row'];

export default function AdminTimePage() {
  const { user, profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  useEffect(() => {
    if (!user || !profile) return;
    loadEmployees();
  }, [user, profile]);

  useEffect(() => {
    if (selectedEmployee) {
      loadTimeEntries();
    }
  }, [selectedEmployee, selectedMonth, selectedYear]);

  const loadEmployees = async () => {
    try {
      const client = createClient();

      const { data } = await client
        .from('employee_details')
        .select('id, first_name, last_name')
        .eq('company_id', profile?.company_id)
        .eq('status', 'active')
        .order('first_name');

      if (data) {
        setEmployees(data);
        if (data.length > 0) {
          setSelectedEmployee(data[0].id);
        }
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const loadTimeEntries = async () => {
    if (!selectedEmployee) return;

    try {
      setLoading(true);
      const result = await getMonthlyTimeEntriesAction(selectedEmployee, selectedYear, selectedMonth);

      if (result.error) {
        setError(result.error);
        return;
      }

      setTimeEntries(result.data || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCorrect = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setEditValues({
      start_time: entry.start_time,
      end_time: entry.end_time,
      break_duration_minutes: entry.break_duration_minutes,
      reason: '',
    });
  };

  const handleSaveCorrection = async (entryId: string) => {
    try {
      if (!editValues.reason || editValues.reason.trim().length < 10) {
        setError('Begründung muss mindestens 10 Zeichen lang sein');
        return;
      }

      const result = await correctTimeEntryAction({
        time_entry_id: entryId,
        start_time: editValues.start_time,
        end_time: editValues.end_time,
        break_duration_minutes: editValues.break_duration_minutes,
        reason: editValues.reason,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setEditingId(null);
      loadTimeEntries();
    } catch (err) {
      setError(String(err));
    }
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${String(mins).padStart(2, '0')}h`;
  };

  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Zeiterfassung – Admin</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="employee" className="block text-sm font-medium mb-1">
              Mitarbeiter
            </label>
            <select
              id="employee"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wählen...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="month" className="block text-sm font-medium mb-1">
              Monat
            </label>
            <select
              id="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {months.map((month, idx) => (
                <option key={idx} value={idx + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="year" className="block text-sm font-medium mb-1">
              Jahr
            </label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Time Entries Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-600">Wird geladen...</div>
      ) : timeEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-600">Keine Zeiteinträge gefunden</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Datum</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Start</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Ende</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Gesamtzeit</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Netto</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {timeEntries.map((entry) => (
                <tr key={entry.id} className={editingId === entry.id ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                  {editingId === entry.id ? (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-900">{entry.date}</td>
                      <td className="px-6 py-4">
                        <input
                          type="time"
                          value={editValues.start_time?.substring(11, 16) || ''}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              start_time: `${entry.date}T${e.target.value}:00`,
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="time"
                          value={editValues.end_time?.substring(11, 16) || ''}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              end_time: `${entry.date}T${e.target.value}:00`,
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                      <td colSpan={3} className="px-6 py-4">
                        <textarea
                          placeholder="Begründung (min. 10 Zeichen)"
                          value={editValues.reason}
                          onChange={(e) => setEditValues({ ...editValues, reason: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          rows={2}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleSaveCorrection(entry.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                        >
                          Speichern
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                        >
                          Abbrechen
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-900">{entry.date}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatTime(entry.start_time)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatTime(entry.end_time)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatDuration(entry.duration_minutes)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatDuration(entry.net_working_minutes)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            entry.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : entry.status === 'corrected'
                              ? 'bg-yellow-100 text-yellow-800'
                              : entry.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => handleCorrect(entry)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Korrigieren
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
