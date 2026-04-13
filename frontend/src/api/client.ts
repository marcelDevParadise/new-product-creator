import type { Product, AttributeConfig, ExportPreview, StammdatenPreview, ExportValidation, Template, AttributeDefinitionCreatePayload, AttributeDefinitionUpdatePayload, PricingSettings, DashboardStats, ActivityLog } from '../types';

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

  // Products
  getProducts: (archived = false) =>
    request<Product[]>(`/products${archived ? '?archived=true' : ''}`),
  getNextSku: () => request<{ sku: string }>('/products/next-sku'),
  getProduct: (sku: string) => request<Product>(`/products/${encodeURIComponent(sku)}`),
  importCsv: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ imported: number; total: number }>('/products/import', {
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
      method: 'PUT',
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

  // Templates
  getTemplates: () => request<Record<string, Template>>('/templates'),
  createTemplate: (name: string, attributes: Record<string, string | number | boolean>) =>
    request<Template>('/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, attributes }),
    }),
  updateTemplate: (name: string, attributes: Record<string, string | number | boolean>) =>
    request<Template>(`/templates/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, attributes }),
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
};
