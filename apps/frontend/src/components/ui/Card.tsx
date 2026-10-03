import { type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Adds a subtle hover lift; useful for clickable cards. */
  interactive?: boolean;
}

export function Card({
  children,
  interactive = false,
  className = '',
  ...rest
}: CardProps) {
  return (
    <div
      className={`bg-surface rounded-2xl border border-white/10 ${
        interactive
          ? 'hover:border-primary/40 transition hover:-translate-y-0.5'
          : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
