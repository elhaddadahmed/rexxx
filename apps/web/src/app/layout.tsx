import type { Metadata } from 'next';
import '../styles/globals.css';
import { AuthProvider } from '@/hooks/useAuth';

export const metadata: Metadata = {
  title: 'Novaro HR',
  description: 'HR-Verwaltung und Zeiterfassung',
  robots: 'noindex,nofollow', // Development-Default
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
