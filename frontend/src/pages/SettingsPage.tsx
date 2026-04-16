import { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { PricingSettings, ExportSettings, DefaultValues, VariantenSettings } from '../types';
import { Save, Plus, X, FileSpreadsheet, Calculator, Ruler, Building2, GitBranch } from 'lucide-react';

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
const selectCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

function SectionCard({ icon: Icon, title, description, children, onSave, saving }: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-6 space-y-5">
        {children}
        <div className="flex justify-end pt-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  // Pricing
  const [mwst, setMwst] = useState('');
  const [faktor, setFaktor] = useState('');
  const [rundung, setRundung] = useState('');
  const [exampleEk, setExampleEk] = useState('10');
  const [exampleVk, setExampleVk] = useState<number | null>(null);
  const [savingPricing, setSavingPricing] = useState(false);

  // Export
  const [attributgruppe, setAttributgruppe] = useState('');
  const [csvTrennzeichen, setCsvTrennzeichen] = useState('');
  const [dezimalformat, setDezimalformat] = useState('');
  const [dateinameMuster, setDateinameMuster] = useState('');
  const [savingExport, setSavingExport] = useState(false);

  // Einheiten
  const [einheiten, setEinheiten] = useState<string[]>([]);
  const [newUnit, setNewUnit] = useState('');
  const [savingUnits, setSavingUnits] = useState(false);

  // Standard-Werte
  const [defaults, setDefaults] = useState<DefaultValues>({ hersteller: '', lieferant_name: '' });
  const [savingDefaults, setSavingDefaults] = useState(false);

  // Varianten
  const [variantenSettings, setVariantenSettings] = useState<VariantenSettings>({ inherit_fields: [], variant_axes: [] });
  const [newAxis, setNewAxis] = useState('');
  const [savingVarianten, setSavingVarianten] = useState(false);

  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      api.getAllSettings(),
      api.getVariantenSettings(),
    ]).then(([s, v]) => {
      setMwst(String(s.pricing.mwst_prozent));
      setFaktor(String(s.pricing.faktor));
      setRundung(String(s.pricing.rundung));
      setAttributgruppe(s.export.attributgruppe);
      setCsvTrennzeichen(s.export.csv_trennzeichen);
      setDezimalformat(s.export.dezimalformat);
      setDateinameMuster(s.export.dateiname_muster);
      setEinheiten(s.einheiten);
      setDefaults(s.standard_werte);
      setVariantenSettings(v);
      setLoading(false);
    }).catch((e) => { toast(e.message, 'error'); setLoading(false); });
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

  const savePricing = async () => {
    setSavingPricing(true);
    try {
      const payload: PricingSettings = {
        mwst_prozent: parseFloat(mwst.replace(',', '.')),
        faktor: parseFloat(faktor.replace(',', '.')),
        rundung: parseFloat(rundung.replace(',', '.')),
      };
      await api.updatePricingSettings(payload);
      toast('Preisberechnung gespeichert', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  const saveExport = async () => {
    setSavingExport(true);
    try {
      const payload: ExportSettings = {
        attributgruppe,
        csv_trennzeichen: csvTrennzeichen,
        dezimalformat,
        dateiname_muster: dateinameMuster,
      };
      await api.updateExportSettings(payload);
      toast('Export-Einstellungen gespeichert', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSavingExport(false);
    }
  };

  const saveUnits = async () => {
    setSavingUnits(true);
    try {
      const updated = await api.updateEinheiten(einheiten);
      setEinheiten(updated);
      toast('Einheiten gespeichert', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSavingUnits(false);
    }
  };

  const saveDefaults = async () => {
    setSavingDefaults(true);
    try {
      await api.updateDefaultValues(defaults);
      toast('Standard-Werte gespeichert', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSavingDefaults(false);
    }
  };

  const saveVarianten = async () => {
    setSavingVarianten(true);
    try {
      await api.updateVariantenSettings(variantenSettings);
      toast('Varianten-Einstellungen gespeichert', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSavingVarianten(false);
    }
  };

  const addAxis = () => {
    const trimmed = newAxis.trim();
    if (trimmed && !variantenSettings.variant_axes.includes(trimmed)) {
      setVariantenSettings(prev => ({ ...prev, variant_axes: [...prev.variant_axes, trimmed] }));
      setNewAxis('');
    }
  };

  const removeAxis = (idx: number) => {
    setVariantenSettings(prev => ({ ...prev, variant_axes: prev.variant_axes.filter((_, i) => i !== idx) }));
  };

  const toggleInheritField = (field: string) => {
    setVariantenSettings(prev => {
      const fields = prev.inherit_fields.includes(field)
        ? prev.inherit_fields.filter(f => f !== field)
        : [...prev.inherit_fields, field];
      return { ...prev, inherit_fields: fields };
    });
  };

  const addUnit = () => {
    const trimmed = newUnit.trim();
    if (trimmed && !einheiten.includes(trimmed)) {
      setEinheiten([...einheiten, trimmed]);
      setNewUnit('');
    }
  };

  const removeUnit = (idx: number) => {
    setEinheiten(einheiten.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-8 space-y-6 max-w-2xl">
        <PageHeader
          title="Einstellungen"
          description="Preisberechnung, Export-Format, Einheiten und Standard-Werte konfigurieren."
        />

        {/* VK-Berechnung */}
        <SectionCard
          icon={Calculator}
          title="VK-Berechnung"
          description={`Formel: EK × (1 + MwSt%) × Faktor → gerundet auf x,${rundung ? String(parseFloat(rundung.replace(',', '.')).toFixed(2)).split('.')[1] : '95'} €`}
          onSave={savePricing}
          saving={savingPricing}
        >
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">MwSt (%)</label>
              <input type="text" className={inputCls} value={mwst} onChange={(e) => setMwst(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Faktor</label>
              <input type="text" className={inputCls} value={faktor} onChange={(e) => setFaktor(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rundung (Endung)</label>
              <input type="text" className={inputCls} value={rundung} onChange={(e) => setRundung(e.target.value)} />
            </div>
          </div>

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
        </SectionCard>

        {/* Export-Konfiguration */}
        <SectionCard
          icon={FileSpreadsheet}
          title="Export-Konfiguration"
          description="CSV-Format und Dateinamen für alle Exporte anpassen."
          onSave={saveExport}
          saving={savingExport}
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Attributgruppen-Name</label>
            <input type="text" className={inputCls} value={attributgruppe} onChange={(e) => setAttributgruppe(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Wird in der Ameise-CSV als Attributgruppe verwendet.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">CSV-Trennzeichen</label>
              <select className={selectCls} value={csvTrennzeichen} onChange={(e) => setCsvTrennzeichen(e.target.value)}>
                <option value=";">Semikolon ( ; )</option>
                <option value=",">Komma ( , )</option>
                <option value="	">Tab</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dezimalformat</label>
              <select className={selectCls} value={dezimalformat} onChange={(e) => setDezimalformat(e.target.value)}>
                <option value=",">Komma ( 10,50 )</option>
                <option value=".">Punkt ( 10.50 )</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Dateinamen-Muster</label>
            <input type="text" className={inputCls} value={dateinameMuster} onChange={(e) => setDateinameMuster(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Verfügbare Platzhalter: <code className="text-gray-500">{'{typ}'}</code> und <code className="text-gray-500">{'{datum}'}</code>. Beispiel: <span className="text-gray-500">{dateinameMuster.replace('{typ}', 'ameise').replace('{datum}', new Date().toISOString().slice(0, 10))}.csv</span>
            </p>
          </div>
        </SectionCard>

        {/* Einheiten */}
        <SectionCard
          icon={Ruler}
          title="Einheiten"
          description="Verfügbare Maßeinheiten für Inhalt, Bezugsmenge und andere Felder."
          onSave={saveUnits}
          saving={savingUnits}
        >
          <div className="flex flex-wrap gap-2">
            {einheiten.map((unit, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-sm text-gray-700 rounded-lg"
              >
                {unit}
                <button
                  onClick={() => removeUnit(idx)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className={inputCls}
              placeholder="Neue Einheit…"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUnit(); } }}
            />
            <button
              onClick={addUnit}
              disabled={!newUnit.trim()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Hinzufügen
            </button>
          </div>
        </SectionCard>

        {/* Standard-Werte */}
        <SectionCard
          icon={Building2}
          title="Standard-Werte"
          description="Standard-Werte die bei neuen Produkten vorausgefüllt werden."
          onSave={saveDefaults}
          saving={savingDefaults}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Standard-Hersteller</label>
              <input
                type="text"
                className={inputCls}
                value={defaults.hersteller}
                onChange={(e) => setDefaults({ ...defaults, hersteller: e.target.value })}
                placeholder="z.B. Eigenmarke GmbH"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Standard-Lieferant</label>
              <input
                type="text"
                className={inputCls}
                value={defaults.lieferant_name}
                onChange={(e) => setDefaults({ ...defaults, lieferant_name: e.target.value })}
                placeholder="z.B. Großhändler XY"
              />
            </div>
          </div>
        </SectionCard>

        {/* Varianten */}
        <SectionCard
          icon={GitBranch}
          title="Varianten"
          description="Varianten-Achsen und Feld-Vererbung für Parent/Child-Gruppierung konfigurieren."
          onSave={saveVarianten}
          saving={savingVarianten}
        >
          {/* Variant axes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Varianten-Achsen</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {variantenSettings.variant_axes.map((axis, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-sm text-purple-700 rounded-lg border border-purple-200">
                  {axis}
                  <button onClick={() => removeAxis(idx)} className="text-purple-400 hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className={inputCls}
                placeholder="Neue Achse (z.B. Länge, Härtegrad)…"
                value={newAxis}
                onChange={(e) => setNewAxis(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAxis(); } }}
              />
              <button
                onClick={addAxis}
                disabled={!newAxis.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Hinzufügen
              </button>
            </div>
          </div>

          {/* Inherit fields */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Vererbbare Felder</label>
            <p className="text-xs text-gray-400 mb-3">Felder die von Parent-Produkten an Varianten vererbt werden, wenn bei der Variante kein eigener Wert gesetzt ist.</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { key: 'hersteller', label: 'Hersteller' },
                { key: 'beschreibung', label: 'Beschreibung' },
                { key: 'kurzbeschreibung', label: 'Kurzbeschreibung' },
                { key: 'url_pfad', label: 'URL-Pfad' },
                { key: 'title_tag', label: 'Title Tag' },
                { key: 'meta_description', label: 'Meta Description' },
                { key: 'lieferant_name', label: 'Lieferant' },
                { key: 'lieferant_artikelnummer', label: 'Lieferant-Art.Nr.' },
                { key: 'lieferant_artikelname', label: 'Lieferant-Art.Name' },
                ...Array.from({ length: 9 }, (_, i) => ({ key: `bild_${i + 1}`, label: `Bild ${i + 1}` })),
                ...Array.from({ length: 6 }, (_, i) => ({ key: `kategorie_${i + 1}`, label: `Kategorie ${i + 1}` })),
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={variantenSettings.inherit_fields.includes(key)}
                    onChange={() => toggleInheritField(key)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
