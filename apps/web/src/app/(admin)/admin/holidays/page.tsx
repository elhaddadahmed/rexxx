'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import type { Database } from '@novaro/shared-types';

type Holiday = Database['public']['Tables']['german_holidays']['Row'];

export default function HolidaysPage() {
  const { user, profile } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [federalState, setFederalState] = useState<string>('');

  const germanStates = [
    'Baden-Württemberg',
    'Bayern',
    'Berlin',
    'Brandenburg',
    'Bremen',
    'Hamburg',
    'Hessen',
    'Mecklenburg-Vorpommern',
    'Niedersachsen',
    'Nordrhein-Westfalen',
    'Rheinland-Pfalz',
    'Saarland',
    'Sachsen',
    'Sachsen-Anhalt',
    'Schleswig-Holstein',
    'Thüringen',
  ];

  useEffect(() => {
    if (!user || !profile) return;

    // Set federal state from company profile
    setFederalState(profile.federal_state || 'DE');
  }, [user, profile]);

  useEffect(() => {
    if (!federalState) return;

    const fetchHolidays = async () => {
      try {
        const client = createClient();

        // Get national holidays + state-specific holidays
        const { data, error: fetchError } = await client
          .from('german_holidays')
          .select('*')
          .eq('year', selectedYear)
          .in('federal_state', ['DE', federalState])
          .order('date');

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        // Remove duplicates (in case federal_state = same as selected)
        const uniqueHolidays = Array.from(
          new Map(data?.map((h) => [h.date, h]) || []).values(),
        );
        setHolidays(uniqueHolidays);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchHolidays();
  }, [selectedYear, federalState]);

  const getMonthName = (date: string) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(d);
  };

  const groupedHolidays = holidays.reduce(
    (acc, holiday) => {
      const month = getMonthName(holiday.date);
      if (!acc[month]) {
        acc[month] = [];
      }
      acc[month].push(holiday);
      return acc;
    },
    {} as Record<string, Holiday[]>,
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Deutsche Feiertage</h1>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 items-end">
          <div>
            <label htmlFor="year" className="block text-sm font-medium mb-1">
              Jahr
            </label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="state" className="block text-sm font-medium mb-1">
              Bundesland
            </label>
            <select
              id="state"
              value={federalState}
              onChange={(e) => setFederalState(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DE">Bundesweit</option>
              {germanStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          {profile?.federal_state && (
            <div className="text-sm text-gray-600 flex-1">
              <span className="font-medium">Firmen-Bundesland:</span> {profile.federal_state}
            </div>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

      {loading ? (
        <div className="text-center py-8 text-gray-600">Wird geladen...</div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-8 text-gray-600">Keine Feiertage gefunden</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedHolidays).map(([month, monthHolidays]) => (
            <div key={month} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b">
                <h2 className="font-semibold text-gray-900">{month}</h2>
              </div>

              <div className="divide-y">
                {monthHolidays.map((holiday) => (
                  <div key={holiday.id} className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-gray-900">{holiday.holiday_name}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(holiday.date).toLocaleDateString('de-DE', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </div>
                    </div>

                    <div>
                      {holiday.is_national_holiday ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Bundesweit
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {holiday.federal_state}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Information</h3>
        <p className="text-sm text-blue-800">
          Diese Feiertage sind integriert in die Zeiterfassung und werden bei der Berechnung von Arbeitszeiten berücksichtigt.
          Feiertage werden nicht als Arbeitstage gezählt (sofern in Ihrem Arbeitszeitmodell konfiguriert).
        </p>
      </div>
    </div>
  );
}
