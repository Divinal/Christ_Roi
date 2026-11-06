import React from 'react';
import { LucideIcon } from 'lucide-react';

const TONES = {
  blue: { box: 'bg-blue-100', icon: 'text-blue-600' },
  green: { box: 'bg-green-100', icon: 'text-green-600' },
  indigo: { box: 'bg-indigo-100', icon: 'text-indigo-600' },
  orange: { box: 'bg-orange-100', icon: 'text-orange-600' },
  red: { box: 'bg-red-100', icon: 'text-red-600' },
} as const;

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  hint?: string;
  valueClassName?: string;
}> = ({ label, value, icon: Icon, tone = 'indigo', hint, valueClassName = 'text-gray-900' }) => (
  <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow md:gap-4 md:p-5">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg md:h-12 md:w-12 ${TONES[tone].box}`}>
      <Icon className={`h-5 w-5 md:h-6 md:w-6 ${TONES[tone].icon}`} />
    </span>
    <div className="min-w-0">
      <p className={`truncate text-xl font-bold md:text-2xl ${valueClassName}`}>{value}</p>
      <p className="truncate text-xs text-gray-600 md:text-sm">{label}</p>
      {hint && <p className="truncate text-xs text-gray-500">{hint}</p>}
    </div>
  </div>
);

export const EmptyState: React.FC<{ icon: LucideIcon; title: string; hint?: string }> = ({
  icon: Icon,
  title,
  hint,
}) => (
  <div className="py-12 text-center">
    <Icon className="mx-auto mb-3 h-12 w-12 text-gray-400" />
    <p className="text-base font-medium text-gray-600">{title}</p>
    {hint && <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{hint}</p>}
  </div>
);

export const Panel: React.FC<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, description, actions, className = '', children }) => (
  <section className={`rounded-xl bg-white p-4 shadow md:p-6 ${className}`}>
    {(title || actions) && (
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          {title && <h2 className="text-lg font-semibold text-gray-900 md:text-xl">{title}</h2>}
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);
