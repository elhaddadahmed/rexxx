'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema } from '@novaro/shared-validation';
import type { LoginInput } from '@novaro/shared-validation';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validierung
    const validation = loginSchema.safeParse(formData);
    if (!validation.success) {
      setValidationError(validation.error.errors[0]?.message || 'Validierungsfehler');
      return;
    }

    try {
      await login(formData.email, formData.password);
      // useAuth Hook wird onAuthStateChange nutzen und redirect durchführen
      // Oder: Manuell redirect nach Erfolg
      router.push('/');
    } catch (err) {
      // Error wird durch useAuth gespeichert
      console.error('Login error:', err);
    }
  };

  const errorMessage = error?.message || validationError;

  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-bold text-center mb-2">Novaro HR</h1>
      <p className="text-sm text-center text-gray-500 mb-6">Anmelden</p>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
          disabled={loading}
        >
          {loading ? 'Wird angemeldet...' : 'Anmelden'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link
          href="/auth/forgot-password"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Passwort vergessen?
        </Link>
      </div>

      <p className="text-xs text-center text-gray-500 mt-6">
        Noch kein Konto?{' '}
        <span className="text-gray-600">
          Kontaktiere deinen Administrator für eine Einladung
        </span>
      </p>
    </div>
  );
}
