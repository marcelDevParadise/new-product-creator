export interface Product {
  artikelnummer: string;
  artikelname: string;
  ek: number | null;
  preis: number | null;
  gewicht: number | null;
  hersteller: string | null;
  ean: string | null;
  // Maße
  laenge: number | null;
  breite: number | null;
  hoehe: number | null;
  // Grundpreis
  verkaufseinheit: number | null;
  inhalt_menge: number | null;
  inhalt_einheit: string | null;
  grundpreis_ausweisen: boolean;
  bezugsmenge: number | null;
  bezugsmenge_einheit: string | null;
  // Lieferant
  lieferant_name: string | null;
  lieferant_artikelnummer: string | null;
  lieferant_artikelname: string | null;
  lieferant_netto_ek: number | null;
  // Bilder
  bild_1: string | null;
  bild_2: string | null;
  bild_3: string | null;
  bild_4: string | null;
  bild_5: string | null;
  bild_6: string | null;
  bild_7: string | null;
  bild_8: string | null;
  bild_9: string | null;
  // Kategorien
  kategorie_1: string | null;
  kategorie_2: string | null;
  kategorie_3: string | null;
  kategorie_4: string | null;
  kategorie_5: string | null;
  kategorie_6: string | null;
  // SEO & Content
  kurzbeschreibung: string | null;
  beschreibung: string | null;
  url_pfad: string | null;
  title_tag: string | null;
  meta_description: string | null;
  //
  attributes: Record<string, string | number | boolean>;
  exported: boolean;
  stammdaten_complete: boolean;
}

export interface SmartDefault {
  title_contains: string;
  value: string;
}

export interface AttributeDefinition {
  id: string;
  category: string;
  name: string;
  description: string;
  required?: boolean;
  required_for_types?: string[];
  default_value?: string;
  suggested_values?: string[];
  smart_defaults?: SmartDefault[];
}

export type AttributeConfig = Record<string, AttributeDefinition>;

export interface AttributeDefinitionCreatePayload {
  key: string;
  id: string;
  category: string;
  name: string;
  description?: string;
  required?: boolean;
  required_for_types?: string[];
  default_value?: string;
  suggested_values?: string[];
  smart_defaults?: SmartDefault[];
}

export interface AttributeDefinitionUpdatePayload {
  id?: string;
  category?: string;
  name?: string;
  description?: string;
  required?: boolean;
  required_for_types?: string[];
  default_value?: string;
  suggested_values?: string[];
  smart_defaults?: SmartDefault[];
}

export interface ExportRow {
  artikelnummer: string;
  artikelname: string;
  attributgruppe: string;
  funktionsattribut: string;
  attributname: string;
  attributwert: string;
}

export interface ExportPreview {
  rows: ExportRow[];
  total_products: number;
  total_rows: number;
}

export interface Template {
  name: string;
  attributes: Record<string, string | number | boolean>;
}

export interface StammdatenRow {
  artikelnummer: string;
  artikelname: string;
  ek: number | null;
  preis: number | null;
  gewicht: number | null;
  hersteller: string;
  ean: string;
  laenge: number | null;
  breite: number | null;
  hoehe: number | null;
  verkaufseinheit: number | null;
  inhalt_menge: number | null;
  inhalt_einheit: string;
  grundpreis_ausweisen: boolean;
  bezugsmenge: number | null;
  bezugsmenge_einheit: string;
  lieferant_name: string;
  lieferant_artikelnummer: string;
  lieferant_artikelname: string;
  lieferant_netto_ek: number | null;
  bild_1: string;
  bild_2: string;
  bild_3: string;
  bild_4: string;
  bild_5: string;
  bild_6: string;
  bild_7: string;
  bild_8: string;
  bild_9: string;
  kategorie_1: string;
  kategorie_2: string;
  kategorie_3: string;
  kategorie_4: string;
  kategorie_5: string;
  kategorie_6: string;
}

export interface StammdatenPreview {
  rows: StammdatenRow[];
  total_products: number;
}

export interface SeoRow {
  artikelnummer: string;
  artikelname: string;
  kurzbeschreibung: string;
  beschreibung: string;
  url_pfad: string;
  title_tag: string;
  meta_description: string;
}

export interface SeoPreview {
  rows: SeoRow[];
  total_products: number;
}

export interface ExportValidation {
  total_products: number;
  warnings: { artikelnummer: string; artikelname: string; missing: string[] }[];
  ok: boolean;
}

export interface PricingSettings {
  mwst_prozent: number;
  faktor: number;
  rundung: number;
}

export interface ExportSettings {
  attributgruppe: string;
  csv_trennzeichen: string;
  dezimalformat: string;
  dateiname_muster: string;
}

export interface DefaultValues {
  hersteller: string;
  lieferant_name: string;
}

export interface AllSettings {
  pricing: PricingSettings;
  export: ExportSettings;
  einheiten: string[];
  standard_werte: DefaultValues;
}

// Dashboard

export interface ActivityLog {
  event_type: string;
  detail: string | null;
  count: number;
  created_at: string;
}

export interface IncompleteProduct {
  artikelnummer: string;
  artikelname: string;
  stammdaten_complete: boolean;
  attribute_count: number;
  missing: string;
}

export interface DashboardStats {
  products_total: number;
  products_active: number;
  products_archived: number;
  stammdaten_complete: number;
  stammdaten_incomplete: number;
  stammdaten_percent: number;
  attributes_with: number;
  attributes_without: number;
  attributes_percent: number;
  export_ready: number;
  export_not_ready: number;
  export_ready_percent: number;
  incomplete_products: IncompleteProduct[];
  recent_activities: ActivityLog[];
}

// Validation / Data Quality

export interface ValidationIssue {
  severity: 'error' | 'warning';
  field: string;
  message: string;
  suggested_fix?: string;
}

export interface ProductValidation {
  artikelnummer: string;
  artikelname: string;
  severity: 'ok' | 'warning' | 'error';
  error_count: number;
  warning_count: number;
  issues: ValidationIssue[];
}

export interface QualityStats {
  total_products: number;
  ok_count: number;
  warning_count: number;
  error_count: number;
  ok_percent: number;
  top_issues: { field: string; count: number }[];
}

export interface ValidationResult {
  stats: QualityStats;
  products: ProductValidation[];
}

// Import

export interface ImportWarning {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  imported: number;
  total: number;
  created: number;
  merged: number;
  skipped: number;
  warnings: ImportWarning[];
}

// Product History

export interface ProductHistoryEntry {
  id: number;
  artikelnummer: string;
  event_type: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  detail: string | null;
  created_at: string;
}

// Categories

export interface CategoryTree {
  [name: string]: CategoryTree;
}
