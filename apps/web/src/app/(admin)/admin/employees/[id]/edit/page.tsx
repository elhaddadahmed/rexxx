'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { updateEmployeeAction } from '../../actions';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import type { Database } from '@novaro/shared-types';

type EmployeeDetails = Database['public']['Tables']['employee_details']['Row'];
type Department = Database['public']['Tables']['departments']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  const { user, profile: currentProfile } = useAuth();

  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [formData, setFormData] = useState({
    position_title: '',
    employment_type: 'full_time' as const,
    department_id: '',
    manager_id: '',
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user || !currentProfile) return;

    const fetchData = async () => {
      const client = createClient();

      // Fetch employee
      const { data: emp } = await client
        .from('employee_details')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (emp) {
        setEmployee(emp);
        setFormData({
          position_title: emp.position_title || '',
          employment_type: emp.employment_type || 'full_time',
          department_id: emp.department_id || '',
          manager_id: emp.manager_id || '',
        });
      }

      // Fetch departments
      const { data: depts } = await client
        .from('departments')
        .select('*')
        .eq('company_id', currentProfile.company_id)
        .order('name');

      setDepartments(depts || []);

      // Fetch users
      const { data: profiles } = await client
        .from('profiles')
        .select('*')
        .eq('company_id', currentProfile.company_id)
        .order('first_name');

      setUsers(profiles || []);

      setLoading(false);
    };

    fetchData();
  }, [user, currentProfile, employeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!user) {
      setError('Nicht authentifiziert');
      setSubmitting(false);
      return;
    }

    try {
      const result = await updateEmployeeAction(
        {
          employee_id: employeeId,
          position_title: formData.position_title || undefined,
          employment_type: formData.employment_type || undefined,
          department_id: formData.department_id || undefined,
          manager_id: formData.manager_id || null,
        },
        user.id,
      );

      if (!result.success) {
        setError(result.error || 'Fehler beim Aktualisieren');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/employees');
      }, 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Wird geladen...</div>;
  }

  if (!employee) {
    return <div className="text-center py-8 text-red-600">Mitarbeiter nicht gefunden</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Mitarbeiter bearbeiten</h1>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
          ✅ Mitarbeiter aktualisiert. Weiterleitung...
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Personalnummer (schreibgeschützt)</label>
          <input
            type="text"
            value={employee.employee_number || ''}
            className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
            disabled
          />
        </div>

        <div>
          <label htmlFor="position_title" className="block text-sm font-medium mb-1">
            Position
          </label>
          <input
            id="position_title"
            type="text"
            value={formData.position_title}
            onChange={(e) => setFormData({ ...formData, position_title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="employment_type" className="block text-sm font-medium mb-1">
              Beschäftigungsart
            </label>
            <select
              id="employment_type"
              value={formData.employment_type}
              onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            >
              <option value="full_time">Vollzeit</option>
              <option value="part_time">Teilzeit</option>
              <option value="contract">Befristeter Vertrag</option>
              <option value="temporary">Leiharbeiter</option>
            </select>
          </div>

          <div>
            <label htmlFor="department_id" className="block text-sm font-medium mb-1">
              Abteilung
            </label>
            <select
              id="department_id"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            >
              <option value="">-- Keine --</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="manager_id" className="block text-sm font-medium mb-1">
            Direkter Vorgesetzter
          </label>
          <select
            id="manager_id"
            value={formData.manager_id}
            onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
          >
            <option value="">-- Kein Manager --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
            disabled={submitting}
          >
            {submitting ? 'Wird aktualisiert...' : 'Speichern'}
          </button>
          <Link
            href="/admin/employees"
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 py-2 rounded-md font-medium text-center transition"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
