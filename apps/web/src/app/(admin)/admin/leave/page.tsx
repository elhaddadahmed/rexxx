'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import {
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
  getPendingLeaveRequestsAction,
} from './actions';
import type { Database } from '@novaro/shared-types';

type LeaveRequest = Database['public']['Tables']['leave_requests']['Row'];

export default function AdminLeaveApprovalsPage() {
  const { user, profile } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPendingRequests();
  }, [user]);

  const loadPendingRequests = async () => {
    try {
      setLoading(true);
      const result = await getPendingLeaveRequestsAction();

      if (result.error) {
        setError(result.error);
        return;
      }

      setPendingRequests(result.data || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, comment?: string) => {
    try {
      setProcessingId(requestId);
      const result = await approveLeaveRequestAction({
        leave_request_id: requestId,
        comment,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess('Antrag genehmigt ✓');
      setTimeout(() => {
        setSuccess(null);
        loadPendingRequests();
      }, 1500);
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string, reason: string) => {
    if (!reason.trim()) {
      setError('Bitte Grund für Ablehnung eingeben');
      return;
    }

    try {
      setProcessingId(requestId);
      const result = await rejectLeaveRequestAction({
        leave_request_id: requestId,
        reason,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess('Antrag abgelehnt ✓');
      setTimeout(() => {
        setSuccess(null);
        loadPendingRequests();
      }, 1500);
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (loading) {
    return <div className="text-center py-8">Wird geladen...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Urlaubsanträge genehmigen</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {pendingRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
          Keine ausstehenden Anträge
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((request) => (
            <div key={request.request_id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{request.employee_name}</div>
                  <div className="text-sm text-gray-600">{request.leave_type_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{request.working_days}</div>
                  <div className="text-xs text-gray-600">Arbeitstage</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-3 mb-4">
                <div className="text-sm text-gray-700">
                  {new Date(request.start_date).toLocaleDateString('de-DE')} bis{' '}
                  {new Date(request.end_date).toLocaleDateString('de-DE')}
                </div>
                {request.reason && <div className="text-sm text-gray-600 mt-1">"{request.reason}"</div>}
              </div>

              {rejectingId === request.request_id ? (
                <div className="mb-4">
                  <textarea
                    placeholder="Grund für Ablehnung..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleReject(request.request_id, rejectReason)}
                      disabled={processingId === request.request_id}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                    >
                      Bestätigen
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason('');
                      }}
                      className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(request.request_id)}
                    disabled={processingId !== null}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                  >
                    Genehmigen
                  </button>
                  <button
                    onClick={() => setRejectingId(request.request_id)}
                    disabled={processingId !== null}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
                  >
                    Ablehnen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
