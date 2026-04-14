import type { Product } from '../../types';

interface Props {
  products: Product[];
}

export function CsvPreview({ products }: Props) {
  if (products.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700">
          Importierte Produkte ({products.length})
        </h3>
      </div>
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Artikelnummer
              </th>
              <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Artikelname
              </th>
              <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Attribute
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => (
              <tr key={p.artikelnummer} className="hover:bg-gray-50">
                <td className="px-5 py-2.5 font-mono text-gray-900">{p.artikelnummer}</td>
                <td className="px-5 py-2.5 text-gray-700">{p.artikelname}</td>
                <td className="px-5 py-2.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      Object.keys(p.attributes).length > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {Object.keys(p.attributes).length}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
