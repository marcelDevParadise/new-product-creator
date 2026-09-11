import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Product, ProductAttributeImportPreview } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

const display = (value: unknown) => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const labels: Record<string, string> = { add: 'Neu', update: 'Ersetzen', unchanged: 'Unverändert', skipped: 'Übersprungen', error: 'Fehler' };

export function AttributeImportDialog({ target, onClose, onImported }: {
  target?: Product; onClose: () => void; onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [products, setProducts] = useState<Product[]>(target ? [target] : []);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [mode, setMode] = useState<'overwrite' | 'fill_empty'>('overwrite');
  const [preview, setPreview] = useState<ProductAttributeImportPreview | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  useEffect(() => {
    if (target) return;
    let cancelled = false;
    Promise.all([api.getProducts(), api.getProducts(true)]).then(([active, archived]) => {
      if (!cancelled) setProducts([...active, ...archived].sort((a, b) => a.artikelnummer.localeCompare(b.artikelnummer)));
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [target]);

  const loadPreview = async () => {
    if (!file) return;
    setBusy(true); setError(''); setResult('');
    try {
      const next = await api.previewProductAttributesXlsx(file, mapping, mode, target?.artikelnummer);
      setPreview(next); setStale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Datei konnte nicht geprüft werden.'); setStale(true);
    } finally { setBusy(false); }
  };
  const importFile = async () => {
    if (!file || !preview || stale) return;
    setBusy(true); setError('');
    try {
      const imported = await api.importProductAttributesXlsx(file, mapping, mode, preview.token, target?.artikelnummer);
      setResult(`${imported.imported} Attributwerte für ${imported.products} Produkte importiert. ${imported.skipped} Zeilen übersprungen, ${imported.unchanged} unverändert.`);
      setPreview(null); onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import fehlgeschlagen.'); setStale(true);
    } finally { setBusy(false); }
  };

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-6xl" showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>Produktattribute aus XLSX importieren</DialogTitle>
        <DialogDescription>
          {target ? `Ziel: ${target.artikelnummer} – ${target.artikelname}. ` : ''}
          Eine Zeile je Attribut: Produkt oder Artikelnummer, Key, Wert. Namen und EANs dienen als Zuordnungsvorschlag.
          Leere Werte löschen nichts. Nicht aufgeführte Attribute bleiben erhalten.
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto">
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1">XLSX-Datei
            <input type="file" accept=".xlsx" disabled={busy} onChange={e => {
              setFile(e.target.files?.[0] ?? null); setMapping({}); setPreview(null); setResult(''); setError(''); setStale(false);
            }} />
          </label>
          <label className="grid gap-1">Vorhandene Werte
            <select className="h-10 rounded-lg border bg-background px-3" value={mode} disabled={busy} onChange={e => {
              setMode(e.target.value as typeof mode); setStale(true); setResult('');
            }}>
              <option value="overwrite">Werte aus der Datei übernehmen</option>
              <option value="fill_empty">Nur leere Attribute ergänzen</option>
            </select>
          </label>
          <Button variant="outline" disabled={!file || busy} onClick={loadPreview}>{busy ? 'Bitte warten…' : 'Vorschau laden'}</Button>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
        {result && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{result}</p>}
        {preview && <>
          <div className="space-y-3 rounded-xl border p-3">
            <p className="font-medium">Produkte zuordnen</p>
            {preview.groups.map(group => <label key={group.source} className="grid gap-1 md:grid-cols-2 md:items-center">
              <span>{group.source || '(Produkt fehlt)'} <span className="text-muted-foreground">({group.count} Zeilen)</span></span>
              <select aria-label={`Zielprodukt für ${group.source}`} className="h-10 min-w-0 rounded-lg border bg-background px-2" disabled={busy}
                value={Object.hasOwn(mapping, group.source) ? mapping[group.source] === null ? '__skip__' : mapping[group.source]! : group.sku ?? ''}
                onChange={e => { setMapping(prev => ({ ...prev, [group.source]: e.target.value === '__skip__' ? null : e.target.value })); setStale(true); }}>
                <option value="">Bitte Produkt wählen</option>
                <option value="__skip__">Dieses Produkt nicht importieren</option>
                {products.map(p => <option key={p.artikelnummer} value={p.artikelnummer}>{p.artikelnummer} – {p.artikelname}{p.exported ? ' (Archiv)' : ''}</option>)}
              </select>
            </label>)}
          </div>
          {stale && <p role="status" className="text-amber-700">Zuordnung oder Einstellungen geändert. Bitte die Vorschau erneut laden.</p>}
          <p className="font-medium">{preview.changes} Änderungen · {preview.products} Produkte · {preview.errors} Fehler · {preview.skipped} übersprungen · {preview.unchanged} unverändert</p>
          {preview.errors > 0 && <p className="text-red-700">Bitte die Fehler korrigieren oder betroffene Produkte ausschließen. Bei Fehlern wird nichts importiert.</p>}
          <div className="max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted"><tr>{['Zeile / Produkt', 'Attribut', 'Bisher', 'Dateiwert', 'Ergebnis'].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead>
              <tbody>{preview.rows.map((row, i) => <tr key={i} className={row.status === 'error' ? 'border-t bg-red-50 text-red-900' : 'border-t'}>
                <td className="p-2 align-top">{row.sheet}:{row.row}<br />{row.sku || row.source}</td>
                <td className="p-2 align-top">{row.name || row.key}<br /><span className="text-muted-foreground">{row.key}</span></td>
                <td className="max-w-64 whitespace-pre-wrap break-words p-2 align-top">{display(row.old_value)}</td>
                <td className="max-w-80 whitespace-pre-wrap break-words p-2 align-top">{display(row.value)}</td>
                <td className="p-2 align-top">{labels[row.status]}{row.message && <p>{row.message}</p>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Quelle und Wertart werden im Änderungsverlauf dokumentiert. Die Datei legt keine neuen Produkte oder Attributdefinitionen an. Eine Übertragung an Artikelwerk erfolgt separat.</p>
        </>}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onClose}>Schließen</Button>
        <Button disabled={busy || stale || !preview || preview.errors > 0 || preview.changes === 0} onClick={importFile}>
          {preview?.changes ?? 0} Attributwerte importieren
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
