import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';
import type { ImportResult } from '../../types';

interface Props {
  onImported: () => void;
}

export function CsvUpload({ onImported }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
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
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <FileText className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-medium">{result.imported} Produkte importiert</span>
              <span className="text-green-600 ml-1">· {result.total} Produkte gesamt</span>
              <div className="flex gap-3 mt-0.5 text-xs text-green-600">
                <span>{result.created} neu</span>
                <span>{result.merged} aktualisiert</span>
                {result.skipped > 0 && <span className="text-amber-600">{result.skipped} übersprungen</span>}
              </div>
            </div>
          </div>
          {result.warnings.length > 0 && (
            <div className="border border-amber-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowWarnings(!showWarnings)}
                className="w-full flex items-center gap-2 p-3 bg-amber-50 text-sm text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left font-medium">{result.warnings.length} Hinweis{result.warnings.length !== 1 ? 'e' : ''} beim Import</span>
                {showWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showWarnings && (
                <div className="divide-y divide-amber-100 max-h-48 overflow-auto">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="px-3 py-2 text-xs text-amber-800 bg-amber-50/50">
                      <span className="font-mono text-amber-600">Zeile {w.row}</span>
                      <span className="mx-1.5">·</span>
                      <span className="font-medium">{w.field}</span>
                      <span className="mx-1.5">—</span>
                      {w.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
