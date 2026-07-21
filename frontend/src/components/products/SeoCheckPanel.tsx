import { CircleCheck, SearchCheck, TriangleAlert } from 'lucide-react';

interface Props {
  titleTag: string;
  metaDescription: string;
  urlPath: string;
  shortDescription: string;
  description: string;
}

interface CheckResult {
  label: string;
  detail: string;
  valid: boolean;
}

function plainText(html: string): string {
  const element = document.createElement('div');
  element.innerHTML = html;
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

export function SeoCheckPanel({ titleTag, metaDescription, urlPath, shortDescription, description }: Props) {
  const shortLength = plainText(shortDescription).length;
  const descriptionLength = plainText(description).length;
  const images = description.match(/<img\b[^>]*>/gi) || [];
  const imagesWithAlt = images.filter((image) => /\balt\s*=\s*(["'])\s*[^"']+\1/i.test(image)).length;
  const hasHeadings = /<h[23]\b/i.test(description);

  const checks: CheckResult[] = [
    {
      label: 'Title-Tag',
      detail: `${titleTag.length} Zeichen; empfohlen sind 30–60.`,
      valid: titleTag.length >= 30 && titleTag.length <= 60,
    },
    {
      label: 'Meta-Description',
      detail: `${metaDescription.length} Zeichen; empfohlen sind 120–160.`,
      valid: metaDescription.length >= 120 && metaDescription.length <= 160,
    },
    {
      label: 'URL-Pfad',
      detail: urlPath.trim() ? 'Ein sprechender URL-Pfad ist vorhanden.' : 'Ein sprechender URL-Pfad fehlt.',
      valid: !!urlPath.trim(),
    },
    {
      label: 'Kurzbeschreibung',
      detail: `${shortLength} Zeichen; empfohlen sind 80–300.`,
      valid: shortLength >= 80 && shortLength <= 300,
    },
    {
      label: 'Beschreibung',
      detail: `${descriptionLength} Zeichen; empfohlen sind mindestens 300.`,
      valid: descriptionLength >= 300,
    },
    {
      label: 'Überschriften',
      detail: hasHeadings ? 'Saubere H2/H3-Struktur vorhanden.' : 'Mindestens eine H2- oder H3-Überschrift fehlt.',
      valid: hasHeadings,
    },
    {
      label: 'Bildbeschreibungen',
      detail: images.length === 0
        ? 'Keine Bilder im Beschreibungstext.'
        : `${imagesWithAlt} von ${images.length} Bildern haben einen Alt-Text.`,
      valid: images.length === 0 || imagesWithAlt === images.length,
    },
  ];

  const validCount = checks.filter((check) => check.valid).length;
  const score = Math.round(validCount / checks.length * 100);
  const scoreClass = score >= 85
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : score >= 60
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
      : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SearchCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">SEO-Prüfung</h4>
            <p className="text-xs text-gray-500">Live-Auswertung der aktuellen Eingaben</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreClass}`}>{score}%</span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => (
          <div
            key={check.label}
            className={`flex gap-2 rounded-lg px-3 py-2.5 ${
              check.valid
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
            }`}
          >
            {check.valid
              ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
            <div className="min-w-0">
              <p className="text-xs font-semibold">{check.label}</p>
              <p className="text-[11px] leading-4 opacity-90">{check.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
