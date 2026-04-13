import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';

interface Props {
  onImported: () => void;
}

export function CsvUpload({ onImported }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; total: number } | null>(null);
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Nur CSV-Dateien sind erlaubt.');
        return;
      }
      setLoading(true);
      try {
        const res = await api.importCsv(file);
        setResult(res);
        toast(`${res.imported} Produkte importiert`, 'success');
        onImported();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Import fehlgeschlagen');
      } finally {
        setLoading(false);
      }
    },
    [onImported],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        <input
          type="file"
          accept=".csv"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          ) : (
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Upload className="w-6 h-6 text-indigo-600" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700">
              CSV hierher ziehen oder <span className="text-indigo-600">Datei auswählen</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Spalten: Artikelnummer; Artikelname (Semikolon-getrennt, UTF-8)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <FileText className="w-4 h-4 flex-shrink-0" />
          {result.imported} Produkte importiert · {result.total} Produkte gesamt
        </div>
      )}
    </div>
  );
}
