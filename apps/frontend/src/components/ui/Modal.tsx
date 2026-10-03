import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode } from 'react';

import { Icon } from './Icon';

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=closed]:animate-out data-[state=open]:animate-in fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="bg-surface fixed top-1/2 left-1/2 z-[101] max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 p-6 shadow-2xl focus:outline-none sm:p-7"
        >
          <Dialog.Close asChild>
            <button
              aria-label="Cerrar"
              className="text-muted hover:border-primary hover:text-foreground absolute top-5 right-5 grid size-9 place-items-center rounded-full border border-white/10 transition"
              type="button"
            >
              <Icon className="size-4" name="close" />
            </button>
          </Dialog.Close>
          {eyebrow && (
            <p className="text-accent text-xs font-semibold tracking-[0.1em] uppercase">
              {eyebrow}
            </p>
          )}
          <Dialog.Title className="font-display mt-1 pr-10 text-xl font-extrabold tracking-tight text-white">
            {title}
          </Dialog.Title>
          <div className="mt-5">{children}</div>
          {footer && (
            <div className="mt-6 flex justify-end gap-2">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
