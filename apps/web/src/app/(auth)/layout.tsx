/**
 * Layout-Group für unauthentifizierte Seiten (Login, Password Reset).
 * Diese Route-Group zeigt sich nur an, wenn der Nutzer noch nicht authentifiziert ist
 * (Redirect-Logik wird in Phase 3 implementiert).
 *
 * Siehe docs/architecture.md — Route-Groups organisieren UI-Struktur, nicht Sicherheit.
 * Die echte Authentifizierungs-Prüfung läuft serverseitig.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center">{children}</div>;
}
