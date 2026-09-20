'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import { assignShiftAction, getShiftCalendarAction } from './actions';
import type { Database } from '@novaro/shared-types';

type ShiftType = Database['public']['Tables']['shift_types']['Row'];
type Employee = Database['public']['Tables']['employee_details']['Row'];

export default function AdminShiftsPage() {
  const { user, profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [shiftCalendar, setShiftCalendar] = useState<any[]>([]);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  useEffect(() => {
    if (selectedDate) {
      loadCalendar();
    }
  }, [selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const client = createClient();

      // Get employees
      const { data: emps } = await client
        .from('employee_details')
        .select('id, first_name, last_name')
        .eq('company_id', profile?.company_id)
        .eq('status', 'active')
        .order('first_name');

      setEmployees(emps || []);

      // Get shift types
      const { data: shifts } = await client
        .from('shift_types')
        .select('*')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .order('start_time');

      setShiftTypes(shifts || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    try {
      const result = await getShiftCalendarAction(selectedDate);
      if (result.error) {
        setError(result.error);
        return;
      }
      setShiftCalendar(result.data || []);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedEmployee || !selectedShift || !selectedDate) {
      setError('Bitte alle erforderlichen Felder ausfüllen');
      return;
    }

    try {
      setSubmitting(true);

      const result = await assignShiftAction({
        employee_id: selectedEmployee,
        shift_type_id: selectedShift,
        assigned_date: selectedDate,
        notes,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess('Schicht erfolgreich zugewiesen ✓');
      setSelectedEmployee('');
      setSelectedShift('');
      setNotes('');

      setTimeout(() => {
        setSuccess(null);
        loadCalendar();
      }, 1500);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Wird geladen...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Schichtplanung</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignment Form */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Neue Schicht</h2>

          <form onSubmit={handleAssignShift} className="space-y-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Datum *
              </label>
              <input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="employee" className="block text-sm font-medium text-gray-700 mb-1">
                Mitarbeiter *
              </label>
              <select
                id="employee"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                required
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
              <label htmlFor="shift" className="block text-sm font-medium text-gray-700 mb-1">
                Schichttyp *
              </label>
              <select
                id="shift"
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wählen...</option>
                {shiftTypes.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time} - {shift.end_time})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notizen (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full px-6 py-2 rounded-lg font-semibold text-white ${
                submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {submitting ? 'Wird zugewiesen...' : 'Schicht zuweisen'}
            </button>
          </form>
        </div>

        {/* Calendar View */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Schichten – {new Date(selectedDate).toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </h2>

          {shiftCalendar.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              Keine Schichten für diesen Tag geplant
            </div>
          ) : (
            <div className="space-y-2">
              {shiftCalendar.map((shift) => (
                <div
                  key={shift.assignment_id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <div className="font-semibold text-gray-900">{shift.employee_name}</div>
                    <div className="text-sm text-gray-600">
                      {shift.shift_name} • {shift.start_time} - {shift.end_time}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
