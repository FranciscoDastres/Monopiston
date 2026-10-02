import { type InputHTMLAttributes, type ReactNode } from 'react';

const controlClass =
  'w-full rounded-xl border border-white/10 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/70 transition focus:border-accent focus:outline-none disabled:opacity-50';

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="text-muted mb-1.5 block text-xs font-semibold tracking-[0.06em] uppercase">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-[#ff8088]">{error}</span>
      ) : (
        hint && <span className="text-muted mt-1 block text-xs">{hint}</span>
      )}
    </label>
  );
}

export function Input({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...rest} />;
}
