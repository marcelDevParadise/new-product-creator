import type { Product, AttributeConfig, ExportPreview, StammdatenPreview, SeoPreview, ExportValidation, Template, AttributeDefinitionCreatePayload, AttributeDefinitionUpdatePayload, PricingSettings, ExportSettings, DefaultValues, AllSettings, DashboardStats, ActivityLog, ValidationResult, ProductValidation, ImportResult, ProductHistoryEntry, CategoryTree, GlobalSearchResult, VariantGroup, VariantSuggestion, VariantenSettings, ResolvedProduct, VariantDiff, ContentScoreResult, PriceStats, SystemHealth, ExportHistoryEntry, HeatmapData, Bundle, Warning, Ingredient } from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${BASE}${url}`, options);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed: ${res.status}`);
      }
      return res.json();
    } catch (err) {
      const isNetwork = err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'));
      if (isNetwork && attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  // Stats
  getStats: () => request<DashboardStats>('/stats'),
  getActivities: (limit = 50) => request<ActivityLog[]>(`/stats/activities?limit=${limit}`),
  globalSearch: (q: string) => request<GlobalSearchResult>(`/stats/search?q=${encodeURIComponent(q)}`),
  getContentScores: () => request<ContentScoreResult>('/stats/content-scores'),
  getPriceStats: () => request<PriceStats>('/stats/prices'),
  getSystemHealth: () => request<SystemHealth>('/stats/health'),
  vacuumDb: () => request<{ success: boolean; old_size: number; new_size: number; saved_bytes: number }>('/stats/vacuum', { method: 'POST' }),

  // Products
  getProducts: (archived = false) =>
    request<Product[]>(`/products${archived ? '?archived=true' : ''}`),
  getNextSku: () => request<{ sku: string }>('/products/next-sku'),
  getProduct: (sku: string) => request<Product>(`/products/${encodeURIComponent(sku)}`),
  importCsv: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<ImportResult>('/products/import', {
      method: 'POST',
      body: form,
    });
  },
  createProduct: (data: { artikelnummer: string; artikelname: string; ek?: number | null; preis?: number | null; gewicht?: number | null; hersteller?: string | null; ean?: string | null }) =>
    request<Product>('/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  clearProducts: () => request<{ cleared: boolean }>('/products', { method: 'DELETE' }),
  deleteProducts: (skus: string[]) =>
    request<{ deleted: number }>('/products/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artikelnummern: skus }),
    }),
  archiveProducts: (skus: string[]) =>
    request<{ archived: number }>('/products/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artikelnummern: skus }),
    }),
  updateStammdaten: (sku: string, data: { artikelname?: string; ek?: number | null; preis?: number | null; gewicht?: number | null; hersteller?: string | null; ean?: string | null }) =>
    request<Product>(`/products/${encodeURIComponent(sku)}/stammdaten`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  unarchiveProduct: (sku: string) =>
    request<Product>(`/products/${encodeURIComponent(sku)}/unarchive`, { method: 'POST' }),
  getProductHistory: (sku: string, limit = 100) =>
    request<ProductHistoryEntry[]>(`/products/${encodeURIComponent(sku)}/history?limit=${limit}`),
  cloneProduct: (sku: string) =>
    request<Product>(`/products/${encodeURIComponent(sku)}/clone`, { method: 'POST' }),

  // Attributes
  getAttributeConfig: () => request<AttributeConfig>('/attributes/config'),
  getCategories: () => request<string[]>('/attributes/categories'),
  createAttributeDefinition: (payload: AttributeDefinitionCreatePayload) =>
    request<Record<string, unknown>>('/attributes/definitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateAttributeDefinition: (key: string, payload: AttributeDefinitionUpdatePayload) =>
    request<Record<string, unknown>>(`/attributes/definitions/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteAttributeDefinition: (key: string) =>
    request<{ deleted: boolean }>(`/attributes/definitions/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }),
  reorderAttributeDefinitions: (orderedKeys: string[]) =>
    request<{ reordered: number }>('/attributes/definitions/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordered_keys: orderedKeys }),
    }),
  updateAttributes: (sku: string, attributes: Record<string, string | number | boolean>) =>
    request<Product>(`/attributes/products/${encodeURIComponent(sku)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes }),
    }),
  deleteAttribute: (sku: string, attrKey: string) =>
    request<Product>(`/attributes/products/${encodeURIComponent(sku)}/${attrKey}`, {
      method: 'DELETE',
    }),
  bulkUpdateAttributes: (skus: string[], attributes: Record<string, string | number | boolean>) =>
    request<{ updated: number }>('/attributes/products/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artikelnummern: skus, attributes }),
    }),
  applySmartDefaults: (sku: string) =>
    request<{ applied: number; product: Product }>(`/attributes/products/${encodeURIComponent(sku)}/smart-defaults`, {
      method: 'POST',
    }),

  // Export
  getExportPreview: () => request<ExportPreview>('/export/preview'),
  validateExport: () => request<ExportValidation>('/export/validate'),
  getExportHistory: (limit = 50) => request<ExportHistoryEntry[]>(`/export/history?limit=${limit}`),
  downloadExport: async () => {
    const res = await fetch(`${BASE}/export/ameise`, { method: 'POST' });
    if (!res.ok) throw new Error('Export fehlgeschlagen');
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename=([^\s;]+)/);
    const filename = filenameMatch ? filenameMatch[1] : 'ameise_export.csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Stammdaten Export
  getStammdatenPreview: () => request<StammdatenPreview>('/export/stammdaten/preview'),
  downloadStammdatenExport: async () => {
    const res = await fetch(`${BASE}/export/stammdaten`, { method: 'POST' });
    if (!res.ok) throw new Error('Stammdaten-Export fehlgeschlagen');
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename=([^\s;]+)/);
    const filename = filenameMatch ? filenameMatch[1] : 'stammdaten_export.csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  archiveExported: () =>
    request<{ archived: number }>('/export/archive-exported', { method: 'POST' }),

  // SEO & Content Export
  getSeoPreview: () => request<SeoPreview>('/export/seo/preview'),
  downloadSeoExport: async () => {
    const res = await fetch(`${BASE}/export/seo`, { method: 'POST' });
    if (!res.ok) throw new Error('SEO-Export fehlgeschlagen');
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename=([^\s;]+)/);
    const filename = filenameMatch ? filenameMatch[1] : 'seo_export.csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Templates
  getTemplates: () => request<Record<string, Template>>('/templates'),
  getTemplateCategories: () => request<string[]>('/templates/categories'),
  createTemplate: (
    name: string,
    attributes: Record<string, string | number | boolean>,
    category = '',
    description = '',
  ) =>
    request<Template>('/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, attributes, category, description }),
    }),
  updateTemplate: (
    name: string,
    attributes: Record<string, string | number | boolean>,
    category = '',
    description = '',
  ) =>
    request<Template>(`/templates/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes, category, description }),
    }),
  updateTemplateMeta: (
    name: string,
    data: { category?: string; description?: string },
  ) =>
    request<Template>(`/templates/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  renameTemplate: (name: string, newName: string) =>
    request<Template>(`/templates/${encodeURIComponent(name)}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: newName }),
    }),
  cloneTemplate: (name: string, newName: string) =>
    request<Template>(`/templates/${encodeURIComponent(name)}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: newName }),
    }),
  deleteTemplate: (name: string) =>
    request<{ deleted: boolean }>(`/templates/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  applyTemplate: (name: string, skus: string[]) =>
    request<{ updated: number; attributes_applied: number }>(
      `/templates/${encodeURIComponent(name)}/apply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artikelnummern: skus }),
      },
    ),

  // Settings
  getPricingSettings: () => request<PricingSettings>('/settings/pricing'),
  updatePricingSettings: (data: PricingSettings) =>
    request<PricingSettings>('/settings/pricing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  calculateVk: (ek: number) =>
    request<{ vk: number | null }>('/settings/pricing/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ek }),
    }),

  // All Settings (combined)
  getAllSettings: () => request<AllSettings>('/settings'),

  // Export Settings
  getExportSettings: () => request<ExportSettings>('/settings/export'),
  updateExportSettings: (data: ExportSettings) =>
    request<ExportSettings>('/settings/export', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Einheiten
  getEinheiten: () => request<string[]>('/settings/einheiten'),
  updateEinheiten: (units: string[]) =>
    request<string[]>('/settings/einheiten', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(units),
    }),

  // Standard-Werte
  getDefaultValues: () => request<DefaultValues>('/settings/defaults'),
  updateDefaultValues: (data: DefaultValues) =>
    request<DefaultValues>('/settings/defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Validation
  getValidation: (severity?: string) =>
    request<ValidationResult>(`/validation${severity ? `?severity=${severity}` : ''}`),
  getProductValidation: (sku: string) =>
    request<ProductValidation>(`/validation/${encodeURIComponent(sku)}`),
  getHeatmap: () => request<HeatmapData>('/validation/heatmap'),

  // Bulk Stammdaten
  bulkUpdateStammdaten: (skus: string[], fields: Record<string, string | number | boolean | null>) =>
    request<{ updated: number; fields: string[] }>('/products/bulk/stammdaten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artikelnummern: skus, fields }),
    }),

  // Categories
  getCategoryTree: () => request<CategoryTree>('/categories/tree'),
  getCategoryChildren: (parent: string) =>
    request<string[]>(`/categories/children?parent=${encodeURIComponent(parent)}`),
  saveCategoryTree: (tree: CategoryTree) =>
    request<CategoryTree>('/categories/tree', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tree),
    }),
  addCategoryNode: (path: string[], name: string) =>
    request<CategoryTree>('/categories/node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    }),
  renameCategoryNode: (path: string[], newName: string) =>
    request<CategoryTree>('/categories/node', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, new_name: newName }),
    }),
  deleteCategoryNode: (path: string[], name: string) =>
    request<CategoryTree>('/categories/node', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    }),

  // Variants
  getVariantGroups: () => request<VariantGroup[]>('/variants/groups'),
  getVariantGroup: (parentSku: string) =>
    request<VariantGroup>(`/variants/groups/${encodeURIComponent(parentSku)}`),
  createVariantGroup: (parentSku: string, childSkus: string[], variantAttributes?: Record<string, Record<string, string>>) =>
    request<{ parent_sku: string; children: number }>('/variants/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_sku: parentSku, child_skus: childSkus, variant_attributes: variantAttributes || {} }),
    }),
  deleteVariantGroup: (parentSku: string) =>
    request<{ dissolved: boolean; children_released: number }>(`/variants/groups/${encodeURIComponent(parentSku)}`, {
      method: 'DELETE',
    }),
  addVariantChild: (parentSku: string, sku: string, variantAttributes?: Record<string, string>) =>
    request<{ added: boolean; sku: string }>(`/variants/groups/${encodeURIComponent(parentSku)}/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, variant_attributes: variantAttributes || {} }),
    }),
  removeVariantChild: (parentSku: string, childSku: string) =>
    request<{ removed: boolean; sku: string }>(`/variants/groups/${encodeURIComponent(parentSku)}/children/${encodeURIComponent(childSku)}`, {
      method: 'DELETE',
    }),
  updateVariantChild: (parentSku: string, childSku: string, variantAttributes: Record<string, string>) =>
    request<{ updated: boolean; sku: string }>(`/variants/groups/${encodeURIComponent(parentSku)}/children/${encodeURIComponent(childSku)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_attributes: variantAttributes }),
    }),
  suggestVariantGroups: () => request<VariantSuggestion[]>('/variants/suggest'),
  getResolvedProduct: (sku: string) =>
    request<ResolvedProduct>(`/variants/resolved/${encodeURIComponent(sku)}`),
  getVariantDiff: (parentSku: string) =>
    request<VariantDiff>(`/variants/groups/${encodeURIComponent(parentSku)}/diff`),
  createVariantChild: (parentSku: string, variantAttributes: Record<string, string>, artikelname?: string) =>
    request<Product>(`/variants/groups/${encodeURIComponent(parentSku)}/children/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_attributes: variantAttributes, artikelname: artikelname || null }),
    }),

  // Varianten Settings
  getVariantenSettings: () => request<VariantenSettings>('/settings/varianten'),
  updateVariantenSettings: (data: VariantenSettings) =>
    request<VariantenSettings>('/settings/varianten', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Bundles
  getBundles: () => request<Bundle[]>('/bundles'),
  getBundle: (id: number) => request<Bundle>(`/bundles/${id}`),
  createBundle: (data: { name: string; description?: string; items: { artikelnummer: string; quantity: number }[] }) =>
    request<{ id: number; name: string }>('/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateBundle: (id: number, data: { name?: string; description?: string; items?: { artikelnummer: string; quantity: number }[] }) =>
    request<{ updated: boolean }>(`/bundles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteBundle: (id: number) =>
    request<{ deleted: boolean }>(`/bundles/${id}`, { method: 'DELETE' }),

  // Warnings
  getWarnings: () => request<Warning[]>('/warnings'),
  createWarning: (data: { code: string; title: string; text?: string; category?: string }) =>
    request<{ id: number; code: string }>('/warnings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateWarning: (id: number, data: { code?: string; title?: string; text?: string; category?: string }) =>
    request<{ updated: boolean }>(`/warnings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteWarning: (id: number) =>
    request<{ deleted: boolean }>(`/warnings/${id}`, { method: 'DELETE' }),
  getProductWarnings: (sku: string) =>
    request<Warning[]>(`/warnings/product/${encodeURIComponent(sku)}`),
  assignWarning: (sku: string, warningId: number) =>
    request<{ assigned: boolean }>(`/warnings/product/${encodeURIComponent(sku)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warning_id: warningId }),
    }),
  unassignWarning: (sku: string, warningId: number) =>
    request<{ removed: boolean }>(`/warnings/product/${encodeURIComponent(sku)}/${warningId}`, { method: 'DELETE' }),

  // Ingredients
  getIngredients: () => request<Ingredient[]>('/ingredients'),
  createIngredient: (data: { name: string; inci_name?: string; cas_number?: string; category?: string }) =>
    request<{ id: number; name: string }>('/ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateIngredient: (id: number, data: { name?: string; inci_name?: string; cas_number?: string; category?: string }) =>
    request<{ updated: boolean }>(`/ingredients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteIngredient: (id: number) =>
    request<{ deleted: boolean }>(`/ingredients/${id}`, { method: 'DELETE' }),
  getProductIngredients: (sku: string) =>
    request<Ingredient[]>(`/ingredients/product/${encodeURIComponent(sku)}`),
  assignIngredient: (sku: string, ingredientId: number, percentage?: string) =>
    request<{ assigned: boolean }>(`/ingredients/product/${encodeURIComponent(sku)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredient_id: ingredientId, percentage: percentage || '' }),
    }),
  unassignIngredient: (sku: string, ingredientId: number) =>
    request<{ removed: boolean }>(`/ingredients/product/${encodeURIComponent(sku)}/${ingredientId}`, { method: 'DELETE' }),
  reorderIngredients: (sku: string, ingredientIds: number[]) =>
    request<{ reordered: boolean }>(`/ingredients/product/${encodeURIComponent(sku)}/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredient_ids: ingredientIds }),
    }),
};
