'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function AdminDashboard() {
  const { profile } = useAuth();

  const cards = [
    {
      title: 'Benutzer',
      description: 'Benutzer verwalten, Rollen zuweisen',
      href: '/admin/users',
      icon: '👤',
      roles: ['company_admin', 'hr_admin', 'super_admin'],
    },
    {
      title: 'Mitarbeiter',
      description: 'Mitarbeiter anzeigen und verwalten',
      href: '/admin/employees',
      icon: '👥',
      roles: ['company_admin', 'hr_admin'],
    },
    {
      title: 'Firmen',
      description: 'Firmen und Konfiguration verwalten',
      href: '/admin/companies',
      icon: '🏢',
      roles: ['super_admin'],
    },
    {
      title: 'Support-Zugriff',
      description: 'Support-Zugriffe genehmigen und verwalten',
      href: '/admin/support-access',
      icon: '🔐',
      roles: ['super_admin'],
    },
    {
      title: 'Audit Logs',
      description: 'Alle Änderungen und Zugriffe überwachen',
      href: '/admin/audit-logs',
      icon: '📋',
      roles: ['company_admin', 'hr_admin', 'super_admin'],
    },
  ];

  const visibleCards = cards.filter((card) => card.roles.includes(profile?.role || ''));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <div className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer p-6">
              <div className="text-4xl mb-4">{card.icon}</div>
              <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
              <p className="text-gray-600 text-sm">{card.description}</p>
              <div className="mt-4 text-blue-600 font-medium">→ Öffnen</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Phase 4 – Admin Dashboard</h3>
        <p className="text-sm text-blue-800">
          Benutzer und Rollen verwalten. Weitere Funktionen (Audit Logs, Companies, Support-Zugriff)
          werden in den nächsten Phasen implementiert.
        </p>
      </div>
    </div>
  );
}
