import { useState } from 'react';
import { Download, Eye, Package, FileText, Archive, Globe } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { api } from '../api/client';
import type { ExportPreview, StammdatenPreview, SeoPreview, ExportValidation } from '../types';

export function ExportPage() {
  const [ameisePreview, setAmeisePreview] = useState<ExportPreview | null>(null);
  const [ameiseLoading, setAmeiseLoading] = useState(false);
  const [ameiseExporting, setAmeiseExporting] = useState(false);
  const [validation, setValidation] = useState<ExportValidation | null>(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [stammdatenPreview, setStammdatenPreview] = useState<StammdatenPreview | null>(null);
  const [stammdatenLoading, setStammdatenLoading] = useState(false);
  const [stammdatenExporting, setStammdatenExporting] = useState(false);
  const [seoPreview, setSeoPreview] = useState<SeoPreview | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoExporting, setSeoExporting] = useState(false);
  const { toast } = useToast();

  const loadAmeisePreview = async () => {
    setAmeiseLoading(true);
    try {
      const data = await api.getExportPreview();
      setAmeisePreview(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Vorschau konnte nicht geladen werden', 'error');
    } finally {
      setAmeiseLoading(false);
    }
  };

  const handleAmeiseExport = async () => {
    // Validate required attributes first
    try {
      const v = await api.validateExport();
      setValidation(v);
      if (!v.ok) {
        setShowExportConfirm(true);
        return;
      }
    } catch { /* skip validation if endpoint fails, proceed */ }
    doAmeiseExport();
  };

  const doAmeiseExport = async () => {
    setAmeiseExporting(true);
    try {
      await api.downloadExport();
      toast('Export erfolgreich — Produkte wurden archiviert', 'success');
      setAmeisePreview(null);
      setValidation(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export fehlgeschlagen', 'error');
    } finally {
      setAmeiseExporting(false);
    }
  };

  const loadStammdatenPreview = async () => {
    setStammdatenLoading(true);
    try {
      const data = await api.getStammdatenPreview();
      setStammdatenPreview(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Vorschau konnte nicht geladen werden', 'error');
    } finally {
      setStammdatenLoading(false);
    }
  };

  const handleStammdatenExport = async () => {
    setStammdatenExporting(true);
    try {
      await api.downloadStammdatenExport();
      toast('Stammdaten-Export erfolgreich', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export fehlgeschlagen', 'error');
    } finally {
      setStammdatenExporting(false);
    }
  };

  const loadSeoPreview = async () => {
    setSeoLoading(true);
    try {
      const data = await api.getSeoPreview();
      setSeoPreview(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Vorschau konnte nicht geladen werden', 'error');
    } finally {
      setSeoLoading(false);
    }
  };

  const handleSeoExport = async () => {
    setSeoExporting(true);
    try {
      await api.downloadSeoExport();
      toast('SEO-Export erfolgreich', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export fehlgeschlagen', 'error');
    } finally {
      setSeoExporting(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Export"
        description="Exportiere Produkt- und Attributdaten als CSV."
      />

      {/* --- Stammdaten Export --- */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Stammdaten-Export</h3>
              <p className="text-xs text-gray-500">Alle Stammdaten als CSV — Preise, Maße, Grundpreis, Lieferant, Bilder, Kategorien</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadStammdatenPreview}
              disabled={stammdatenLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              {stammdatenLoading ? 'Lade...' : 'Vorschau'}
            </button>
            <button
              onClick={handleStammdatenExport}
              disabled={stammdatenExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {stammdatenExporting ? 'Exportiere...' : 'CSV exportieren'}
            </button>
          </div>
        </div>

        {stammdatenPreview && (
          <div>
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-xs text-gray-500">
                {stammdatenPreview.total_products} Produkte
              </span>
            </div>
            {stammdatenPreview.rows.length > 0 ? (
              <div className="overflow-x-auto max-h-[20rem]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Artikelnr.</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Artikelname</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">EK</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">VK</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Gewicht</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Hersteller</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">EAN</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">L×B×H</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Lieferant</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Kategorien</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Bilder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stammdatenPreview.rows.slice(0, 50).map((row, i) => {
                      const dims = [row.laenge, row.breite, row.hoehe].filter((v) => v != null);
                      const bilder = [row.bild_1, row.bild_2, row.bild_3, row.bild_4, row.bild_5, row.bild_6, row.bild_7, row.bild_8, row.bild_9].filter(Boolean).length;
                      const kats = [row.kategorie_1, row.kategorie_2, row.kategorie_3, row.kategorie_4, row.kategorie_5, row.kategorie_6].filter(Boolean);
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-gray-700 whitespace-nowrap">{row.artikelnummer}</td>
                          <td className="px-4 py-2 text-gray-600 max-w-[200px] truncate">{row.artikelname}</td>
                          <td className="px-4 py-2 text-right text-gray-600 tabular-nums whitespace-nowrap">
                            {row.ek != null ? `${row.ek.toFixed(2)} €` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900 tabular-nums whitespace-nowrap">
                            {row.preis != null ? `${row.preis.toFixed(2)} €` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900 tabular-nums whitespace-nowrap">
                            {row.gewicht != null ? `${row.gewicht} g` : '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{row.hersteller || '—'}</td>
                          <td className="px-4 py-2 font-mono text-gray-500 whitespace-nowrap">{row.ean || '—'}</td>
                          <td className="px-4 py-2 text-right text-gray-600 tabular-nums whitespace-nowrap">
                            {dims.length > 0 ? dims.join(' × ') : '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{row.lieferant_name || '—'}</td>
                          <td className="px-4 py-2 text-gray-600 max-w-[180px] truncate">
                            {kats.length > 0 ? kats.join(' › ') : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500 whitespace-nowrap">{bilder > 0 ? `${bilder} Bild${bilder > 1 ? 'er' : ''}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Keine aktiven Produkte vorhanden.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* --- Ameise Attribut-Export --- */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Attribut-Export (JTL Ameise)</h3>
              <p className="text-xs text-gray-500">Eine Zeile pro Attribut — Shopify-Metafelder für JTL Ameise.</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <Archive className="w-3 h-3" />
              Archiviert Produkte nach Export
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadAmeisePreview}
              disabled={ameiseLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              {ameiseLoading ? 'Lade...' : 'Vorschau'}
            </button>
            <button
              onClick={handleAmeiseExport}
              disabled={ameiseExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {ameiseExporting ? 'Exportiere...' : 'CSV exportieren'}
            </button>
          </div>
        </div>

        {ameisePreview && (
          <div>
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex gap-6">
              <span className="text-xs text-gray-500">
                {ameisePreview.total_products} Produkte mit Attributen
              </span>
              <span className="text-xs text-gray-500">
                {ameisePreview.total_rows} Export-Zeilen
              </span>
            </div>
            {ameisePreview.rows.length > 0 ? (
              <div className="overflow-x-auto max-h-[20rem]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Artikelnr.</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Artikelname</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Attributgruppe</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Funktionsattribut</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Attributname</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Attributwert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ameisePreview.rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-gray-700">{row.artikelnummer}</td>
                        <td className="px-4 py-2 text-gray-600 max-w-[200px] truncate">{row.artikelname}</td>
                        <td className="px-4 py-2 text-gray-600">{row.attributgruppe}</td>
                        <td className="px-4 py-2 font-mono text-gray-500 max-w-[200px] truncate">{row.funktionsattribut}</td>
                        <td className="px-4 py-2 text-gray-700">{row.attributname}</td>
                        <td className="px-4 py-2 text-gray-900 font-medium">{row.attributwert}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Keine Attribute zum Exportieren. Weise zuerst Attribute zu.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Validation warning dialog for Ameise export */}
      {showExportConfirm && validation && !validation.ok && (
        <ConfirmDialog
          title="Fehlende Pflichtattribute"
          message={`${validation.warnings.length} von ${validation.total_products} Produkten haben fehlende Pflichtattribute:\n\n${validation.warnings.slice(0, 5).map((w) => `• ${w.artikelnummer}: ${w.missing.join(', ')}`).join('\n')}${validation.warnings.length > 5 ? `\n… und ${validation.warnings.length - 5} weitere` : ''}\n\nTrotzdem exportieren?`}
          confirmLabel="Trotzdem exportieren"
          variant="danger"
          onConfirm={() => { setShowExportConfirm(false); doAmeiseExport(); }}
          onCancel={() => setShowExportConfirm(false)}
        />
      )}

      {/* --- SEO & Content Export --- */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <Globe className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">SEO & Content Export</h3>
              <p className="text-xs text-gray-500">Kurzbeschreibung, Beschreibung, URL-Pfad, Title Tag, Meta-Description</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadSeoPreview}
              disabled={seoLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              {seoLoading ? 'Lade...' : 'Vorschau'}
            </button>
            <button
              onClick={handleSeoExport}
              disabled={seoExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {seoExporting ? 'Exportiere...' : 'CSV exportieren'}
            </button>
          </div>
        </div>

        {seoPreview && (
          <div>
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-xs text-gray-500">
                {seoPreview.total_products} Produkte
              </span>
            </div>
            {seoPreview.rows.length > 0 ? (
              <div className="overflow-x-auto max-h-[20rem]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Artikelnr.</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Artikelname</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Kurzbeschreibung</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">URL-Pfad</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Title Tag</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">Meta-Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {seoPreview.rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-gray-700 whitespace-nowrap">{row.artikelnummer}</td>
                        <td className="px-4 py-2 text-gray-600 max-w-[180px] truncate">{row.artikelname}</td>
                        <td className="px-4 py-2 text-gray-600 max-w-[200px] truncate">{row.kurzbeschreibung || '—'}</td>
                        <td className="px-4 py-2 font-mono text-gray-500 max-w-[150px] truncate">{row.url_pfad || '—'}</td>
                        <td className="px-4 py-2 text-gray-700 max-w-[180px] truncate">
                          <span className={row.title_tag.length > 60 ? 'text-red-600' : ''}>{row.title_tag || '—'}</span>
                        </td>
                        <td className="px-4 py-2 text-gray-600 max-w-[220px] truncate">
                          <span className={row.meta_description.length > 155 ? 'text-red-600' : ''}>{row.meta_description || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Keine aktiven Produkte vorhanden.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
