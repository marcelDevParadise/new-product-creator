import { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { PricingSettings } from '../types';
import { Save } from 'lucide-react';

export function SettingsPage() {
  const [settings, setSettings] = useState<PricingSettings | null>(null);
  const [mwst, setMwst] = useState('');
  const [faktor, setFaktor] = useState('');
  const [rundung, setRundung] = useState('');
  const [saving, setSaving] = useState(false);
  const [exampleEk, setExampleEk] = useState('10');
  const [exampleVk, setExampleVk] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.getPricingSettings().then((s) => {
      setSettings(s);
      setMwst(String(s.mwst_prozent));
      setFaktor(String(s.faktor));
      setRundung(String(s.rundung));
    });
  }, []);

  // Live preview calculation
  useEffect(() => {
    const ek = parseFloat((exampleEk || '0').replace(',', '.'));
    const m = parseFloat((mwst || '0').replace(',', '.'));
    const f = parseFloat((faktor || '0').replace(',', '.'));
    const r = parseFloat((rundung || '0').replace(',', '.'));
    if (isNaN(ek) || isNaN(m) || isNaN(f) || isNaN(r) || ek <= 0) {
      setExampleVk(null);
      return;
    }
    const rawVk = ek * (1 + m / 100) * f;
    const ending = r - Math.floor(r);
    let result = Math.floor(rawVk) + ending;
    if (rawVk - Math.floor(rawVk) >= ending) {
      result = Math.floor(rawVk) + ending;
    } else {
      result = Math.floor(rawVk) - 1 + ending;
    }
    if (result < ek) result = Math.floor(rawVk) + ending;
    setExampleVk(Math.round(result * 100) / 100);
  }, [exampleEk, mwst, faktor, rundung]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: PricingSettings = {
        mwst_prozent: parseFloat(mwst.replace(',', '.')),
        faktor: parseFloat(faktor.replace(',', '.')),
        rundung: parseFloat(rundung.replace(',', '.')),
      };
      await api.updatePricingSettings(payload);
      toast('Einstellungen gespeichert', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Einstellungen"
        description="VK-Preisberechnung konfigurieren."
      />

      <div className="max-w-2xl bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">VK-Berechnung</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Formel: EK × (1 + MwSt%) × Faktor → gerundet auf x,{rundung ? String(parseFloat(rundung.replace(',', '.')).toFixed(2)).split('.')[1] : '95'} €
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">MwSt (%)</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={mwst}
                onChange={(e) => setMwst(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Faktor</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={faktor}
                onChange={(e) => setFaktor(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rundung (Endung)</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={rundung}
                onChange={(e) => setRundung(e.target.value)}
              />
            </div>
          </div>

          {/* Live-Vorschau */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Live-Vorschau</p>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">EK (Netto)</label>
                <input
                  type="text"
                  className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={exampleEk}
                  onChange={(e) => setExampleEk(e.target.value)}
                />
              </div>
              <div className="pt-4 text-gray-400">→</div>
              <div className="pt-4">
                <span className="text-lg font-bold text-gray-900">
                  {exampleVk != null ? `${exampleVk.toFixed(2)} €` : '—'}
                </span>
                <span className="text-xs text-gray-500 ml-2">VK (Brutto)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Speichere...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
