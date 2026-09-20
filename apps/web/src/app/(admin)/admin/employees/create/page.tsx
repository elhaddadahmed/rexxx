'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createEmployeeAction } from '../actions';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import type { Database } from '@novaro/shared-types';

type Department = Database['public']['Tables']['departments']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export default function CreateEmployeePage() {
  const router = useRouter();
  const { user, profile: currentProfile } = useAuth();
  const [formData, setFormData] = useState({
    profile_id: '',
    employee_number: '',
    position_title: '',
    employment_type: 'full_time' as const,
    hired_at: new Date().toISOString().split('T')[0],
    department_id: '',
    manager_id: '',
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!currentProfile) return;

    const fetchData = async () => {
      const client = createClient();

      // Fetch departments
      const { data: depts } = await client
        .from('departments')
        .select('*')
        .eq('company_id', currentProfile.company_id)
        .order('name');

      setDepartments(depts || []);

      // Fetch available users (without employee_details)
      const { data: profiles } = await client
        .from('profiles')
        .select('*')
        .eq('company_id', currentProfile.company_id)
        .neq('role', 'super_admin')
        .order('first_name');

      setUsers(profiles || []);
    };

    fetchData();
  }, [currentProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!user) {
      setError('Nicht authentifiziert');
      setLoading(false);
      return;
    }

    try {
      const result = await createEmployeeAction(
        {
          profile_id: formData.profile_id,
          employee_number: formData.employee_number,
          position_title: formData.position_title,
          employment_type: formData.employment_type,
          hired_at: new Date(formData.hired_at),
          department_id: formData.department_id,
          manager_id: formData.manager_id || null,
        },
        user.id,
      );

      if (!result.success) {
        setError(result.error || 'Fehler beim Erstellen');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/employees');
      }, 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Neuer Mitarbeiter</h1>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
          ✅ Mitarbeiter erfolgreich erstellt. Weiterleitung...
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label htmlFor="profile_id" className="block text-sm font-medium mb-1">
            Benutzer *
          </label>
          <select
            id="profile_id"
            value={formData.profile_id}
            onChange={(e) => setFormData({ ...formData, profile_id: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            required
          >
            <option value="">-- Benutzer wählen --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name} ({u.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="employee_number" className="block text-sm font-medium mb-1">
            Personalnummer *
          </label>
          <input
            id="employee_number"
            type="text"
            value={formData.employee_number}
            onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            required
            placeholder="z.B. EMP-001"
          />
        </div>

        <div>
          <label htmlFor="position_title" className="block text-sm font-medium mb-1">
            Position *
          </label>
          <input
            id="position_title"
            type="text"
            value={formData.position_title}
            onChange={(e) => setFormData({ ...formData, position_title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            required
            placeholder="z.B. Software Engineer"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="employment_type" className="block text-sm font-medium mb-1">
              Beschäftigungsart *
            </label>
            <select
              id="employment_type"
              value={formData.employment_type}
              onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="full_time">Vollzeit</option>
              <option value="part_time">Teilzeit</option>
              <option value="contract">Befristeter Vertrag</option>
              <option value="temporary">Leiharbeiter</option>
            </select>
          </div>

          <div>
            <label htmlFor="hired_at" className="block text-sm font-medium mb-1">
              Einstellungsdatum *
            </label>
            <input
              id="hired_at"
              type="date"
              value={formData.hired_at}
              onChange={(e) => setFormData({ ...formData, hired_at: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="department_id" className="block text-sm font-medium mb-1">
              Abteilung *
            </label>
            <select
              id="department_id"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            >
              <option value="">-- Abteilung wählen --</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
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
              disabled={loading}
            >
              <option value="">-- Kein Manager --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
            disabled={loading}
          >
            {loading ? 'Wird erstellt...' : 'Erstellen'}
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
