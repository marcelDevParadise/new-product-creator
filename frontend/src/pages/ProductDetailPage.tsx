import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle, Wand2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import { AttributeEditor } from '../components/products/AttributeEditor';
import { api } from '../api/client';
import type { Product, AttributeConfig } from '../types';

export function ProductDetailPage() {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<AttributeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSmartDefaults = async () => {
    if (!product) return;
    try {
      const { applied, product: updated } = await api.applySmartDefaults(product.artikelnummer);
      setProduct(updated);
      toast(applied > 0 ? `${applied} Attribute automatisch gesetzt` : 'Keine Smart Defaults gefunden', applied > 0 ? 'success' : 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Smart Defaults fehlgeschlagen', 'error');
    }
  };

  const handleArchive = async () => {
    if (!product) return;
    try {
      await api.archiveProducts([product.artikelnummer]);
      toast('Produkt archiviert', 'success');
      navigate('/products');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivieren fehlgeschlagen', 'error');
    }
  };

  useEffect(() => {
    if (!sku) return;
    const decodedSku = decodeURIComponent(sku);
    Promise.all([api.getProduct(decodedSku), api.getAttributeConfig()])
      .then(([p, c]) => {
        setProduct(p);
        setConfig(c);
      })
      .catch((e) => setError(e.message));
  }, [sku]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive max-w-md text-center">
          {error}
        </div>
      </div>
    );
  }

  if (!product || !config) {
    return <LoadingSpinner className="h-full" />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-8 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button onClick={() => navigate('/products')} className="hover:text-foreground transition-colors">
            Produkte
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{product.artikelnummer}</span>
        </nav>
        <div className="flex-1" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold truncate">{product.artikelname}</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground font-mono">{product.artikelnummer}</span>
            {product.ek != null && (
              <span className="text-xs text-muted-foreground">EK {product.ek.toFixed(2)} €</span>
            )}
            {product.preis != null && (
              <span className="text-xs text-muted-foreground">VK {product.preis.toFixed(2)} €</span>
            )}
            {product.gewicht != null && (
              <span className="text-xs text-muted-foreground">{product.gewicht} g</span>
            )}
            {product.hersteller && (
              <span className="text-xs text-muted-foreground">{product.hersteller}</span>
            )}
            {product.ean && (
              <span className="text-xs text-muted-foreground font-mono">{product.ean}</span>
            )}
          </div>
        </div>
        {product.stammdaten_complete && (
          <Button variant="outline" size="sm" onClick={handleSmartDefaults} className="shrink-0 gap-1.5">
            <Wand2 className="w-3.5 h-3.5" />
            Smart Defaults
          </Button>
        )}
        {product.exported && (
          <Badge variant="secondary" className="shrink-0">Exportiert</Badge>
        )}
        <Button variant="outline" size="sm" onClick={handleArchive} className="shrink-0 gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50">
          <Archive className="w-3.5 h-3.5" />
          Archivieren
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {!product.stammdaten_complete ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <p className="text-sm text-gray-600 text-center max-w-md">
              Die Stammdaten für dieses Produkt sind noch nicht vollständig ausgefüllt.
              Bitte zuerst die Stammdaten vervollständigen.
            </p>
            <Button
              onClick={() => navigate(`/stammdaten/${encodeURIComponent(product.artikelnummer)}`)}
              className="mt-2"
            >
              Stammdaten bearbeiten
            </Button>
          </div>
        ) : (
          <AttributeEditor
            product={product}
            attributeConfig={config}
            onSaved={(updated) => setProduct(updated)}
          />
        )}
      </div>
    </div>
  );
}
