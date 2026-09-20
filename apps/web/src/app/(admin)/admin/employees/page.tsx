'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import type { Database } from '@novaro/shared-types';

type EmployeeDetails = Database['public']['Tables']['employee_details']['Row'] & {
  profiles?: Database['public']['Tables']['profiles']['Row'];
  departments?: Database['public']['Tables']['departments']['Row'];
};

export default function EmployeeListPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');

  useEffect(() => {
    if (!user) return;

    const fetchEmployees = async () => {
      try {
        const client = createClient();

        let query = client
          .from('employee_details')
          .select(`
            *,
            profiles:profile_id (*),
            departments (*),
            managers:manager_id (first_name, last_name, email)
          `)
          .order('hired_at', { ascending: false });

        // Filter by status
        if (filterStatus === 'active') {
          query = query.neq('status', 'deactivated');
        } else if (filterStatus === 'deactivated') {
          query = query.eq('status', 'deactivated');
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        // Client-side search filter
        let filtered = data || [];
        if (search) {
          const searchLower = search.toLowerCase();
          filtered = filtered.filter(
            (emp) =>
              emp.employee_number?.toLowerCase().includes(searchLower) ||
              emp.profiles?.first_name?.toLowerCase().includes(searchLower) ||
              emp.profiles?.last_name?.toLowerCase().includes(searchLower) ||
              emp.profiles?.email?.toLowerCase().includes(searchLower),
          );
        }

        setEmployees(filtered);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [user, filterStatus, search]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mitarbeiter</h1>
        <Link
          href="/admin/employees/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition"
        >
          + Neuer Mitarbeiter
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Nach Name, E-Mail, Personalnummer suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Aktiv</option>
            <option value="deactivated">Deaktiviert</option>
            <option value="">Alle</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

      {loading ? (
        <div className="text-center py-8 text-gray-600">Wird geladen...</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-8 text-gray-600">Keine Mitarbeiter gefunden</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Personalnummer</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">E-Mail</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Position</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Abteilung</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">{emp.employee_number}</td>
                  <td className="px-6 py-4 text-sm">
                    {emp.profiles?.first_name} {emp.profiles?.last_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{emp.profiles?.email}</td>
                  <td className="px-6 py-4 text-sm">{emp.position_title}</td>
                  <td className="px-6 py-4 text-sm">{emp.departments?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        emp.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {emp.status === 'deactivated' ? 'Inaktiv' : 'Aktiv'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-2">
                    <Link
                      href={`/admin/employees/${emp.id}/edit`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Bearbeiten
                    </Link>
                    {emp.status !== 'deactivated' && (
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
