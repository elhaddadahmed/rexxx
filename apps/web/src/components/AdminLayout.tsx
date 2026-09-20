'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, profile, logout } = useAuth();
  const router = useRouter();

  if (!user || !profile) {
    return null;
  }

  const isAdmin =
    profile.role === 'company_admin' ||
    profile.role === 'hr_admin' ||
    profile.role === 'super_admin';

  if (!isAdmin) {
    return null; // ProtectedRoute wird redirect machen
  }

  const navItems = [
    {
      label: 'Dashboard',
      href: '/admin',
      roles: ['company_admin', 'hr_admin', 'super_admin'],
    },
    {
      label: 'Benutzer',
      href: '/admin/users',
      roles: ['company_admin', 'hr_admin', 'super_admin'],
    },
    {
      label: 'Mitarbeiter',
      href: '/admin/employees',
      roles: ['company_admin', 'hr_admin'],
    },
    {
      label: 'Abteilungen',
      href: '/admin/departments',
      roles: ['company_admin', 'hr_admin'],
    },
    {
      label: 'Arbeitszeitmodelle',
      href: '/admin/work-time-models',
      roles: ['company_admin', 'hr_admin'],
    },
    {
      label: 'Feiertage',
      href: '/admin/holidays',
      roles: ['company_admin', 'hr_admin'],
    },
    {
      label: 'Zeiterfassung',
      href: '/admin/time',
      roles: ['company_admin', 'hr_admin'],
    },
    {
      label: 'Urlaubsanträge',
      href: '/admin/leave',
      roles: ['company_admin', 'hr_admin'],
    },
    {
      label: 'Schichtplanung',
      href: '/admin/shifts',
      roles: ['company_admin', 'hr_admin'],
    },
    {
      label: 'Dokumente',
      href: '/admin/documents',
      roles: ['company_admin', 'hr_admin'],
    },
    {
      label: 'Benachrichtigungen',
      href: '/notifications',
      roles: ['company_admin', 'hr_admin', 'manager', 'employee'],
    },
    {
      label: 'Firmen',
      href: '/admin/companies',
      roles: ['super_admin'],
    },
    {
      label: 'Support-Zugriff',
      href: '/admin/support-access',
      roles: ['super_admin'],
    },
    {
      label: 'Audit Logs',
      href: '/admin/audit-logs',
      roles: ['company_admin', 'hr_admin', 'super_admin'],
    },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(profile.role));

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Novaro HR</h1>
            <p className="text-sm text-gray-600">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              {profile?.first_name || 'Admin'} ({profile.role})
            </span>
            <button
              onClick={() => {
                logout();
                router.push('/auth/login');
              }}
              className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex gap-6 px-4 sm:px-6 lg:px-8 py-6">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0">
          <nav className="bg-white rounded-lg shadow p-4 space-y-2">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
