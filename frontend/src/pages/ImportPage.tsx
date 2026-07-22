import { useState, useEffect } from 'react';
import { WorkspaceHeader } from '../components/layout/WorkspaceHeader';
import { CsvUpload } from '../components/csv/CsvUpload';
import { CsvPreview } from '../components/csv/CsvPreview';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { Product } from '../types';
import { FileDown, Upload, Package } from 'lucide-react';
import { Button } from '../components/ui/button';

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
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
      <div className="mx-auto w-full max-w-[1920px] space-y-5 p-4 md:p-6 xl:px-8 xl:py-7 2xl:px-10">
      <WorkspaceHeader
        eyebrow="Datenübernahme"
        title="CSV Import"
        description="Importiere eine CSV-Datei mit Artikelnummer und Artikelname."
        icon={Upload}
        stats={[{ label: 'Aktive Produkte', value: products.length, icon: Package, tone: 'indigo' }]}
        actions={
          <Button variant="outline" className="bg-background/70" onClick={downloadTemplate}><FileDown className="mr-2 h-4 w-4" />Vorlage herunterladen</Button>
        }
      />
      <div className="space-y-6">
        <CsvUpload onImported={loadProducts} />
        <CsvPreview products={products} />
      </div>
      </div>
    </div>
  );
}
