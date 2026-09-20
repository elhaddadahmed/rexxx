'use client';

import { AdminRootLayout } from '@/components/AdminRootLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRootLayout>{children}</AdminRootLayout>;
}
