'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/AdminLayout';
import { ROLE } from '@novaro/shared-constants';

interface AdminRootLayoutProps {
  children: React.ReactNode;
}

export function AdminRootLayout({ children }: AdminRootLayoutProps) {
  return (
    <ProtectedRoute
      requiredRoles={[ROLE.COMPANY_ADMIN, ROLE.HR_ADMIN, ROLE.SUPER_ADMIN]}
      fallback={<div className="text-center py-8">Admin-Bereich nicht verfügbar</div>}
    >
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}
