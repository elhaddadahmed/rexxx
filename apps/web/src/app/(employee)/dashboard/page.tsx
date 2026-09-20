'use client';

import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ROLE } from '@novaro/shared-constants';
import Link from 'next/link';

function DashboardContent() {
  const { user, profile, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Novaro HR</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              {profile?.first_name || 'Mitarbeiter'} {profile?.last_name}
            </span>
            <button
              onClick={() => logout()}
              className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Profil Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Mein Profil</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-600">E-Mail:</dt>
                <dd className="font-medium">{profile?.email}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Rolle:</dt>
                <dd className="font-medium capitalize">{profile?.role}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Status:</dt>
                <dd className="font-medium capitalize">
                  {profile?.status === 'active' ? (
                    <span className="text-green-600">Aktiv</span>
                  ) : (
                    <span className="text-yellow-600">{profile?.status}</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-blue-600 hover:text-blue-700">
                  → Zeiterfassung
                </Link>
              </li>
              <li>
                <Link href="#" className="text-blue-600 hover:text-blue-700">
                  → Urlaub beantragen
                </Link>
              </li>
              <li>
                <Link href="#" className="text-blue-600 hover:text-blue-700">
                  → Meine Dokumente
                </Link>
              </li>
              <li>
                <Link href="#" className="text-blue-600 hover:text-blue-700">
                  → Benachrichtigungen
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            ℹ️ Diese Seite ist ein Skeleton für Phase 3. Weitere Funktionen werden in den nächsten
            Phasen (Phase 5–9) implementiert: Zeiterfassung, Urlaub, Dokumente, etc.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function EmployeeDashboard() {
  return (
    <ProtectedRoute requiredRoles={[ROLE.EMPLOYEE, ROLE.MANAGER, ROLE.HR_ADMIN, ROLE.COMPANY_ADMIN]}>
      <DashboardContent />
    </ProtectedRoute>
  );
}
