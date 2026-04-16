import { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { CsvUpload } from '../components/csv/CsvUpload';
import { CsvPreview } from '../components/csv/CsvPreview';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { Product } from '../types';
import { FileDown } from 'lucide-react';

export function ImportPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const { toast } = useToast();

  const loadProducts = async () => {
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch {
      toast('Backend ist noch nicht erreichbar', 'info');
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const downloadTemplate = () => {
    window.open('/api/products/import/template', '_blank');
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="CSV Import"
        description="Importiere eine CSV-Datei mit Artikelnummer und Artikelname."
        actions={
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Vorlage herunterladen
          </button>
        }
      />
      <div className="space-y-6">
        <CsvUpload onImported={loadProducts} />
        <CsvPreview products={products} />
      </div>
    </div>
  );
}
