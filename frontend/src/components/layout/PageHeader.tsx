import type { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, subtitle, icon: Icon, actions, className }: Props) {
  const sub = description || subtitle;
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${className ?? ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />}
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 truncate">{title}</h2>
          {sub && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{sub}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
