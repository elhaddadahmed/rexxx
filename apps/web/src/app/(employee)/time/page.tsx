'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import { completeTimeEntryAction, createTimeEntryAction, getDailyTimeSummaryAction } from './actions';
import type { Database } from '@novaro/shared-types';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];

export default function TimePage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timing, setTiming] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [breaks, setBreaks] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;
    loadTodayEntry();
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timing && currentEntry) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timing, currentEntry]);

  const loadTodayEntry = async () => {
    try {
      setLoading(true);
      const client = createClient();

      // Get employee detail
      const { data: employee } = await client
        .from('employee_details')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!employee) return;

      // Get today's entries
      const { data: entries } = await client
        .from('time_entries')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .order('created_at', { ascending: false });

      if (entries && entries.length > 0) {
        const last = entries[0];
        setCurrentEntry(last);
        setTiming(last.status === 'in_progress');

        if (last.end_time) {
          const start = new Date(last.start_time);
          const end = new Date(last.end_time);
          setElapsedSeconds(Math.round((end.getTime() - start.getTime()) / 1000));
        }
      }

      // Load daily summary
      const summaryResult = await getDailyTimeSummaryAction({
        employee_id: employee.id,
        date: today,
      });

      if (summaryResult.data) {
        setDailySummary(summaryResult.data);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    try {
      setError(null);
      const client = createClient();

      const { data: employee } = await client
        .from('employee_details')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!employee) {
        setError('Mitarbeiter nicht gefunden');
        return;
      }

      const result = await createTimeEntryAction({
        employee_id: employee.id,
        date: today,
        start_time: new Date().toISOString(),
        source: 'mobile',
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setCurrentEntry(result.data);
      setTiming(true);
      setElapsedSeconds(0);
      setSuccessMessage('Zeiterfassung gestartet ✓');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleClockOut = async () => {
    try {
      setError(null);

      if (!currentEntry) {
        setError('Keine aktive Zeiterfassung');
        return;
      }

      const result = await completeTimeEntryAction({
        time_entry_id: currentEntry.id,
        end_time: new Date().toISOString(),
        break_duration_minutes: breaks,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setTiming(false);
      setCurrentEntry(result.data);
      setSuccessMessage('Zeiterfassung beendet ✓');
      setTimeout(() => setSuccessMessage(null), 3000);

      // Reload summary
      const summaryResult = await getDailyTimeSummaryAction({
        employee_id: currentEntry.employee_id,
        date: today,
      });

      if (summaryResult.data) {
        setDailySummary(summaryResult.data);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="text-center py-8">Wird geladen...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Zeiterfassung</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {/* Clock Display */}
      <div className="bg-white rounded-lg shadow p-8 mb-6">
        <div className="text-center">
          <div className="text-6xl font-mono font-bold text-gray-900 mb-4">{formatTime(elapsedSeconds)}</div>

          <div className="text-sm text-gray-600 mb-6">
            {timing ? '⏱️ Läuft' : currentEntry ? '⏹️ Beendet' : '⏸️ Keine aktive Erfassung'}
          </div>

          {/* Clock In/Out Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleClockIn}
              disabled={timing}
              className={`px-8 py-3 rounded-lg font-semibold text-white ${
                timing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Start
            </button>

            <button
              onClick={handleClockOut}
              disabled={!timing}
              className={`px-8 py-3 rounded-lg font-semibold text-white ${
                !timing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Stop
            </button>
          </div>
        </div>
      </div>

      {/* Break Duration */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pausenzeit (Minuten)</label>
        <input
          type="number"
          min="0"
          max="480"
          value={breaks}
          onChange={(e) => setBreaks(Math.max(0, parseInt(e.target.value) || 0))}
          disabled={timing}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Daily Summary */}
      {dailySummary && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Heute</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Gesamtzeit</div>
              <div className="text-2xl font-bold text-gray-900">
                {dailySummary.duration_minutes ? `${Math.floor(dailySummary.duration_minutes / 60)}:${String(dailySummary.duration_minutes % 60).padStart(2, '0')}` : '-'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Arbeitszeit (netto)</div>
              <div className="text-2xl font-bold text-gray-900">
                {dailySummary.net_working_minutes
                  ? `${Math.floor(dailySummary.net_working_minutes / 60)}:${String(dailySummary.net_working_minutes % 60).padStart(2, '0')}`
                  : '-'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Sollzeit</div>
              <div className="text-2xl font-bold text-gray-900">
                {dailySummary.expected_duration_minutes
                  ? `${Math.floor(dailySummary.expected_duration_minutes / 60)}:${String(dailySummary.expected_duration_minutes % 60).padStart(2, '0')}`
                  : '-'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Überstunden</div>
              <div className={`text-2xl font-bold ${(dailySummary.overtime_minutes || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dailySummary.overtime_minutes
                  ? `${Math.floor(Math.abs(dailySummary.overtime_minutes) / 60)}:${String(Math.abs(dailySummary.overtime_minutes) % 60).padStart(2, '0')}`
                  : '-'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
