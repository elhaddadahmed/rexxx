'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { requestPasswordResetSchema } from '@novaro/shared-validation';
import type { RequestPasswordResetInput } from '@novaro/shared-validation';

export default function ForgotPasswordPage() {
  const { resetPassword, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validierung
    const validation = requestPasswordResetSchema.safeParse({ email });
    if (!validation.success) {
      setValidationError(validation.error.errors[0]?.message || 'Validierungsfehler');
      return;
    }

    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch (err) {
      console.error('Password reset error:', err);
    }
  };

  const errorMessage = error?.message || validationError;

  if (submitted) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">E-Mail gesendet</h1>
        <p className="text-gray-700 mb-6">
          Prüfe dein E-Mail-Postfach (und Spam-Ordner) für einen Link zum Zurücksetzen deines
          Passworts. Der Link ist 24 Stunden lang gültig.
        </p>
        <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Zurück zum Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-bold text-center mb-2">Passwort zurücksetzen</h1>
      <p className="text-sm text-center text-gray-500 mb-6">
        Gib deine E-Mail ein, um einen Passwort-Reset-Link zu erhalten
      </p>

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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
          disabled={loading}
        >
          {loading ? 'Wird gesendet...' : 'Link senden'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link href="/auth/login" className="text-sm text-blue-600 hover:text-blue-700">
          Zurück zum Login
        </Link>
      </div>
    </div>
  );
}
