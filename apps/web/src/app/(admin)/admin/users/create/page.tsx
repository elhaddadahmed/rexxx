'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserAction } from './actions';
import { useAuth } from '@/hooks/useAuth';

export default function CreateUserPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'employee' as const,
    companyId: profile?.company_id || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await createUserAction(formData);

      if (!result.success) {
        setError(result.error || 'Fehler beim Erstellen des Benutzers');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/users');
      }, 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Neuer Benutzer</h1>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
          ✅ Benutzer erfolgreich erstellt. Weiterleitung...
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            E-Mail *
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium mb-1">
              Vorname *
            </label>
            <input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium mb-1">
              Nachname *
            </label>
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium mb-1">
            Rolle *
          </label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="employee">Mitarbeiter</option>
            <option value="manager">Manager</option>
            {profile?.role === 'company_admin' && <option value="hr_admin">HR-Administrator</option>}
            {profile?.role === 'super_admin' && <option value="company_admin">Firmen-Administrator</option>}
          </select>
        </div>

        <p className="text-sm text-gray-600 mt-6">
          Hinweis: Der Benutzer erhält eine Einladungs-E-Mail mit einem Link, um sein Passwort zu setzen.
        </p>

        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
            disabled={loading}
          >
            {loading ? 'Wird erstellt...' : 'Erstellen'}
          </button>
          <Link
            href="/admin/users"
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 py-2 rounded-md font-medium text-center transition"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
