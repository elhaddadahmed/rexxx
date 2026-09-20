'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import type { Database } from '@novaro/shared-types';

type Department = Database['public']['Tables']['departments']['Row'];

export default function DepartmentsPage() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const fetchDepartments = async () => {
      try {
        const client = createClient();
        const { data, error: fetchError } = await client
          .from('departments')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('name');

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        setDepartments(data || []);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, [profile]);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || !profile) return;

    setSubmitting(true);
    try {
      const client = createClient();
      const { data, error: createError } = await client
        .from('departments')
        .insert({
          company_id: profile.company_id,
          name: newDeptName,
        })
        .select()
        .single();

      if (createError) {
        setError(createError.message);
        return;
      }

      setDepartments([...departments, data]);
      setNewDeptName('');
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Abteilungen</h1>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

      {/* Add Department Form */}
      <form onSubmit={handleAddDepartment} className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Neue Abteilung..."
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50 transition"
            disabled={submitting || !newDeptName.trim()}
          >
            {submitting ? 'Wird erstellt...' : 'Hinzufügen'}
          </button>
        </div>
      </form>

      {/* Departments List */}
      {loading ? (
        <div className="text-center py-8 text-gray-600">Wird geladen...</div>
      ) : departments.length === 0 ? (
        <div className="text-center py-8 text-gray-600">Keine Abteilungen vorhanden</div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="divide-y">
            {departments.map((dept) => (
              <div key={dept.id} className="p-4 hover:bg-gray-50">
                <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                {dept.parent_department_id && (
                  <p className="text-sm text-gray-600">Unterabteilung</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
