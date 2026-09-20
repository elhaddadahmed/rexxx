'use client';

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-100 p-4">
        <h2 className="text-lg font-bold mb-6">Team-Manager</h2>
        <nav className="space-y-2 text-sm">{/* Menü: Team Approvals, Team Overview */}</nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
