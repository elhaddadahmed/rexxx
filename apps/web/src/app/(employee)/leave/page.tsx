'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import {
  createLeaveRequestAction,
  getLeaveBalanceAction,
  getLeaveRequestsAction,
} from './actions';
import type { Database } from '@novaro/shared-types';

type LeaveType = Database['public']['Tables']['leave_types']['Row'];
type LeaveRequest = Database['public']['Tables']['leave_requests']['Row'];

export default function LeavePage() {
  const { user, profile } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<Record<string, any>>({});

  const [selectedType, setSelectedType] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const client = createClient();

      // Get leave types
      const { data: types } = await client
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      setLeaveTypes(types || []);

      // Get employee ID
      const { data: empData } = await client
        .from('employee_details')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!empData) return;

      // Get leave requests
      const reqResult = await getLeaveRequestsAction(empData.id, currentYear);
      setLeaveRequests(reqResult.data || []);

      // Get balances for each type
      if (types && types.length > 0) {
        const balancesMap: Record<string, any> = {};
        for (const type of types) {
          const balResult = await getLeaveBalanceAction({
            employee_id: empData.id,
            leave_type_id: type.id,
            year: currentYear,
          });
          balancesMap[type.id] = balResult.data || {};
        }
        setBalances(balancesMap);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedType || !startDate || !endDate) {
      setError('Bitte alle erforderlichen Felder ausfüllen');
      return;
    }

    try {
      setSubmitting(true);

      const { data: empData } = await createClient()
        .from('employee_details')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!empData) {
        setError('Mitarbeiter nicht gefunden');
        return;
      }

      const result = await createLeaveRequestAction({
        employee_id: empData.id,
        leave_type_id: selectedType,
        start_date: startDate,
        end_date: endDate,
        reason,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess('Urlaubsantrag erfolgreich eingereicht ✓');
      setSelectedType('');
      setStartDate('');
      setEndDate('');
      setReason('');

      // Reload data
      setTimeout(() => loadData(), 1500);
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
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Urlaub & Abwesenheiten</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {leaveTypes.map((type) => {
          const balance = balances[type.id] || {};
          return (
            <div key={type.id} className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-1">{type.name}</div>
              <div className="text-2xl font-bold text-gray-900">
                {balance.remaining_days ?? '-'}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Verbleibend von {balance.entitled_days ?? '-'} Tagen
              </div>
            </div>
          );
        })}
      </div>

      {/* Leave Request Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Neuer Urlaubsantrag</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Urlaubstyp *
            </label>
            <select
              id="type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wählen...</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Startdatum *
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                Enddatum *
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Begründung (optional)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
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
            {submitting ? 'Wird eingereicht...' : 'Antrag einreichen'}
          </button>
        </form>
      </div>

      {/* Leave Requests List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold">Meine Anträge</h2>
        </div>

        {leaveRequests.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-600">Keine Anträge vorhanden</div>
        ) : (
          <div className="divide-y">
            {leaveRequests.map((request) => {
              const type = leaveTypes.find((t) => t.id === request.leave_type_id);
              return (
                <div key={request.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">{type?.name || 'Unbekannt'}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(request.start_date).toLocaleDateString('de-DE')} bis{' '}
                        {new Date(request.end_date).toLocaleDateString('de-DE')} ({request.working_days}{' '}
                        Tage)
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : request.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {request.status === 'approved'
                        ? 'Genehmigt'
                        : request.status === 'rejected'
                        ? 'Abgelehnt'
                        : 'Ausstehend'}
                    </span>
                  </div>

                  {request.reason && <div className="text-sm text-gray-600 mb-2">{request.reason}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
