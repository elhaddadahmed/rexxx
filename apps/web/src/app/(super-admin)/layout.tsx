'use client';

/**
 * Super-Admin-only Bereich.
 * Phase 3 wird die echte Permission-Prüfung hinzufügen.
 */

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-900 text-white p-4">
        <h2 className="text-lg font-bold mb-6">System Admin</h2>
        <nav className="space-y-2 text-sm">{/* Menü wird in späteren Phasen befüllt */}</nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
