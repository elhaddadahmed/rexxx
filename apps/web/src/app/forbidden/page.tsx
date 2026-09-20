'use client';

import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">403</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Zugriff verweigert</h2>
        <p className="text-gray-600 mb-8">
          Du hast keine Berechtigung, auf diese Ressource zuzugreifen.
        </p>

        <Link
          href="/"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md font-medium transition"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
