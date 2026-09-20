'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROLE } from '@novaro/shared-constants';

/**
 * Root Page – Redirect basierend auf User Role
 * 
 * SUPER_ADMIN → /super-admin/companies
 * COMPANY_ADMIN → /company-admin/employees
 * HR_ADMIN → /hr-admin/employees
 * MANAGER → /manager/team-approvals
 * EMPLOYEE → /employee/dashboard
 * Unauthenticated → /auth/login
 */
export default function HomePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (!profile) {
      // User exists aber kein Profile — Error State
      router.push('/auth/login');
      return;
    }

    // Role-basierter Redirect
    const redirectMap: Record<string, string> = {
      [ROLE.SUPER_ADMIN]: '/super-admin/companies',
      [ROLE.COMPANY_ADMIN]: '/company-admin/employees',
      [ROLE.HR_ADMIN]: '/hr-admin/employees',
      [ROLE.MANAGER]: '/manager/team-approvals',
      [ROLE.EMPLOYEE]: '/employee/dashboard',
    };

    const redirectPath = redirectMap[profile.role] || '/auth/login';
    router.push(redirectPath);
  }, [user, profile, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg text-gray-600">Wird weitergeleitet...</div>
    </div>
  );
}
