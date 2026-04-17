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
  seo_keywords: string | null;
  // Varianten
  parent_sku: string | null;
  is_parent: boolean;
  variant_attributes: Record<string, string>;
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
  category: string;
  description: string;
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
  // Extended KPIs
  products_without_images: number;
  products_without_ean: number;
  products_with_errors: number;
  seo_complete: number;
  seo_percent: number;
  avg_attributes_per_product: number;
  // Content Score
  content_score_avg: number;
  content_complete: number;
  content_partial: number;
  content_empty: number;
  recently_updated: IncompleteProduct[];
  incomplete_products: IncompleteProduct[];
  recent_activities: ActivityLog[];
}

export interface ContentScoreProduct {
  artikelnummer: string;
  artikelname: string;
  score: number;
  score_percent: number;
  missing: string[];
}

export interface ContentScoreResult {
  products: ContentScoreProduct[];
  total: number;
  complete: number;
  avg_percent: number;
}

export interface PriceStats {
  avg_ek: number;
  avg_vk: number;
  avg_margin: number;
  avg_margin_percent: number;
  products_without_ek: number;
  products_without_vk: number;
  products_negative_margin: number;
  min_ek: number | null;
  max_ek: number | null;
  min_vk: number | null;
  max_vk: number | null;
  critical_margin_products: { artikelnummer: string; artikelname: string; ek: number; vk: number; margin: number; margin_percent: number }[];
}

export interface SystemHealth {
  db_size_bytes: number;
  db_size_display: string;
  products_count: number;
  activity_log_count: number;
  product_history_count: number;
  attribute_definitions_count: number;
  templates_count: number;
  uptime_seconds: number;
  uptime_display: string;
  python_version: string;
  integrity_ok: boolean;
}

export interface ExportHistoryEntry {
  id: number;
  export_type: string;
  filename: string;
  product_count: number;
  row_count: number;
  created_at: string;
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

// Global Search

export interface GlobalSearchResult {
  products: { artikelnummer: string; artikelname: string; archived: boolean }[];
  attributes: { key: string; name: string; category: string }[];
  templates: { name: string; attribute_count: number }[];
}

// Variants

export interface VariantGroup {
  parent: Product;
  children: Product[];
  variant_axes: string[];
}

export interface VariantSuggestion {
  suggested_parent: string;
  members: string[];
  common_name: string;
  differences: string[];
}

export interface VariantenSettings {
  inherit_fields: string[];
  variant_axes: string[];
}

export interface ResolvedProduct {
  product: Product;
  inherited_fields: string[];
}

export type VariantDiff = Record<string, Record<string, { parent_value: string | null; child_value: string | null }>>;

// Bundles

export interface BundleItem {
  artikelnummer: string;
  quantity: number;
  artikelname: string;
  ek: number | null;
  preis: number | null;
}

export interface Bundle {
  id: number;
  name: string;
  description: string;
  items: BundleItem[];
  total_ek: number;
  total_vk: number;
  created_at: string;
  updated_at: string;
}

// Warnings

export interface Warning {
  id: number;
  code: string;
  title: string;
  text: string;
  category: string;
  created_at?: string;
  usage_count?: number;
}

// Ingredients

export interface Ingredient {
  id: number;
  name: string;
  inci_name: string;
  cas_number: string;
  category: string;
  created_at?: string;
  usage_count?: number;
  percentage?: string;
  position?: number;
}
