import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { AttributeConfig } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';
import { AttributeWizard } from './wizard/AttributeWizard';

interface Props {
  selectedSkus: string[];
  attributeConfig: AttributeConfig;
  onClose: () => void;
  onSaved: () => void;
}

export function BulkAttributeModal({ selectedSkus, attributeConfig, onClose, onSaved }: Props) {
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/50 backdrop-blur-sm md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card shadow-2xl w-full md:max-w-5xl h-full md:h-[85vh] md:rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Bulk-Bearbeitung</h2>
            <p className="text-sm text-muted-foreground">
              {selectedSkus.length} Produkte ausgewählt — nur befüllte Werte werden angewendet
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4">
          <AttributeWizard
            mode="bulk"
            attributeConfig={attributeConfig}
            initialValues={{}}
            saveLabel={`Auf ${selectedSkus.length} Produkte anwenden`}
            onSave={async (values) => {
              if (Object.keys(values).length === 0) {
                toast('Keine Werte zum Anwenden', 'info');
                return;
              }
              await api.bulkUpdateAttributes(selectedSkus, values);
              toast(`Attribute für ${selectedSkus.length} Produkte aktualisiert`, 'success');
              onSaved();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
