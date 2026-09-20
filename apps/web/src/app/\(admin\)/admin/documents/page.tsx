'use client';

import { useEffect, useState } from 'react';
import { uploadDocumentAction, getDocumentsAction, approveDocumentAction, deleteDocumentAction } from './actions';

interface Document {
  document_id: string;
  filename: string;
  document_type: string;
  employee_name: string;
  uploaded_at: string;
  status: string;
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    const result = await getDocumentsAction();
    if (result.error) {
      setError(result.error);
    } else {
      setDocuments(result.data || []);
      setError(null);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const result = await uploadDocumentAction({
        filename: file.name,
        file_size_bytes: file.size,
        file_type: file.name.split('.').pop() || 'unknown',
        mime_type: file.type,
        document_type: 'employee_document',
        description: 'Hochgeladenes Dokument',
        requires_approval: false,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMessage('Dokument erfolgreich hochgeladen');
        await loadDocuments();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (documentId: string) => {
    const result = await approveDocumentAction({ document_id: documentId });
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage('Dokument genehmigt');
      await loadDocuments();
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Dokument wirklich löschen?')) return;
    const result = await deleteDocumentAction({ document_id: documentId });
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage('Dokument gelöscht');
      await loadDocuments();
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dokumentverwaltung</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Verträge, Gehaltsabrechnungen und Mitarbeiterdokumente verwalten
        </p>
      </div>

      {/* Upload Section */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Dokument hochladen</h2>
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Klicken zum Hochladen</span> oder Datei ziehen
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">PDF, Word, Excel oder Bild (Max 50MB)</p>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
              accept=".pdf,.docx,.doc,.xlsx,.jpg,.png,.jpeg"
            />
          </label>
        </div>
        {uploading && <p className="mt-2 text-sm text-blue-600">Wird hochgeladen...</p>}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">Fehler: {error}</p>
        </div>
      )}
      {successMessage && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-300">{successMessage}</p>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Dokumente ({documents.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">Keine Dokumente vorhanden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Dateiname
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Mitarbeiter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Hochgeladen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {documents.map((doc) => (
                  <tr key={doc.document_id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {doc.filename}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        {doc.document_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {doc.employee_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doc.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Genehmigt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Ausstehend
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(doc.uploaded_at).toLocaleDateString('de-DE', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {doc.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(doc.document_id)}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                        >
                          Genehmigen
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(doc.document_id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
