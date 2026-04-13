import { Loader2 } from 'lucide-react';

interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function LoadingSpinner({ className = '', size = 'md' }: Props) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status" aria-busy="true">
      <Loader2 className={`${sizeMap[size]} text-indigo-600 animate-spin`} />
      <span className="sr-only">Laden…</span>
    </div>
  );
}
