/**
 * Determine the field input type from a Shopify metafield ID.
 */
export function getFieldType(metafieldId: string): 'boolean' | 'number' | 'textarea' | 'tags' | 'text' {
  if (metafieldId === 'tags') return 'tags';
  if (metafieldId.includes(':boolean')) return 'boolean';
  if (metafieldId.includes(':number_integer')) return 'number';
  if (metafieldId.includes(':multi_line_text_field') || metafieldId.includes(':list.single_line_text_field'))
    return 'textarea';
  return 'text';
}
