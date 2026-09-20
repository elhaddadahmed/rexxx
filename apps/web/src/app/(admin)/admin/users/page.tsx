'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import type { Database } from '@novaro/shared-types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        const client = createClient();
        const { data, error: fetchError } = await client
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        setUsers(data || []);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Benutzer</h1>
        <Link
          href="/admin/users/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition"
        >
          + Neuer Benutzer
        </Link>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

      {loading ? (
        <div className="text-center py-8 text-gray-600">Wird geladen...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-gray-600">Keine Benutzer gefunden</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">E-Mail</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Rolle</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    {user.first_name} {user.last_name || ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium capitalize">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : user.status === 'invited'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-2">
                    <Link
                      href={`/admin/users/${user.id}/edit`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Bearbeiten
                    </Link>
                    <button className="text-red-600 hover:text-red-700">Löschen</button>
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
