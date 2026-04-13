import { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { CsvUpload } from '../components/csv/CsvUpload';
import { CsvPreview } from '../components/csv/CsvPreview';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { Product } from '../types';

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

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="CSV Import"
        description="Importiere eine CSV-Datei mit Artikelnummer und Artikelname."
      />
      <div className="space-y-6">
        <CsvUpload onImported={loadProducts} />
        <CsvPreview products={products} />
      </div>
    </div>
  );
}
