import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

export interface WorkspaceStat {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: 'indigo' | 'sky' | 'emerald' | 'amber' | 'violet';
}

interface WorkspaceHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: ReactNode;
  stats?: WorkspaceStat[];
}

const toneClasses: Record<NonNullable<WorkspaceStat['tone']>, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

export function WorkspaceHeader({ eyebrow, title, description, icon: Icon, actions, stats }: WorkspaceHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border bg-card/90 p-5 shadow-sm md:p-7">
      <div className="pointer-events-none absolute -right-24 -top-36 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-sky-500/8 blur-3xl" />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
            <Icon className="h-6 w-6" />
            <Sparkles className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-card p-0.5 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">{eyebrow}</p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {!!stats?.length && (
        <div className={`relative mt-6 grid gap-3 sm:grid-cols-2 ${stats.length >= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
          {stats.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className="group flex items-center gap-3 rounded-2xl border bg-background/65 p-4 shadow-sm backdrop-blur transition hover:bg-background">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${toneClasses[stat.tone ?? 'indigo']}`}>
                  <StatIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-semibold leading-none tabular-nums">{stat.value}</p>
                    <p className="truncate text-sm font-medium">{stat.label}</p>
                  </div>
                  {stat.detail && <p className="mt-1 truncate text-[11px] text-muted-foreground">{stat.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
