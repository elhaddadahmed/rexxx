'use client';

export default function HRAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-100 p-4">
        <h2 className="text-lg font-bold mb-6">HR</h2>
        <nav className="space-y-2 text-sm">{/* Menü: Employees, Leave, Documents, Payroll Prep */}</nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
