import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Template, AttributeConfig } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';
import { AttributeWizard } from './wizard/AttributeWizard';

interface Props {
  template: Template;
  attributeConfig: AttributeConfig;
  onClose: () => void;
  onSaved: () => void;
}

export function TemplateAttributeEditor({ template, attributeConfig, onClose, onSaved }: Props) {
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Vorlage bearbeiten</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{template.name}</span>
              {template.category && <> · <span className="text-primary">{template.category}</span></>}
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
            mode="template"
            attributeConfig={attributeConfig}
            initialValues={template.attributes}
            saveLabel="Vorlage speichern"
            onSave={async (values) => {
              await api.updateTemplate(template.name, values, template.category, template.description);
              toast('Vorlage gespeichert', 'success');
              onSaved();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
