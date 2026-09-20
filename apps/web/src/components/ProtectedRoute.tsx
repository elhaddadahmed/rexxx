/**
 * ProtectedRoute – HOC für geschützte Seiten
 * 
 * Prüft, ob User authentifiziert + richtige Rolle/Permission hat.
 * Falls nicht: Redirect zu Login oder Forbidden-Seite.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROLE, type Role } from '@novaro/shared-constants';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role;
  requiredRoles?: Role[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredRoles,
  fallback,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    // Warte bis Auth-State geladen ist
    if (loading) return;

    // User nicht authentifiziert → Redirect zu Login
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // User authentifiziert aber kein Profil → Error
    if (!profile) {
      console.error('User authentifiziert aber kein Profil gefunden');
      router.push('/auth/login');
      return;
    }

    // Role-Check
    const allowedRoles = requiredRoles || (requiredRole ? [requiredRole] : []);
    if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role as Role)) {
      // Falsche Rolle → Forbidden oder redirect
      router.push('/forbidden');
      return;
    }
  }, [user, profile, loading, router, requiredRole, requiredRoles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Wird geladen...</div>
      </div>
    );
  }

  if (!user || !profile) {
    return fallback || null;
  }

  // Role-Check
  const allowedRoles = requiredRoles || (requiredRole ? [requiredRole] : []);
  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role as Role)) {
    return fallback || <div className="p-6 text-red-600">Zugriff verweigert</div>;
  }

  return <>{children}</>;
}

/**
 * withProtectedRoute – Higher-Order Component für Pages
 * 
 * Usage:
 *   const ProtectedPage = withProtectedRoute(MyPage, { requiredRoles: [ROLE.COMPANY_ADMIN] })
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>,
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
