import { useState, type FormEvent } from 'react';

import { Modal } from '../../components/ui/Modal';
import { useAuth } from './auth-context';

const GOOGLE_LOGIN_URL = `${import.meta.env.VITE_API_URL ?? ''}/v1/auth/google?returnTo=/app`;

interface LoginModalProps {
  onClose: () => void;
  open: boolean;
}

/**
 * Sign-in dialog. Offers "Acceder con Google" (the real OAuth entry point) and a
 * local credentials form reserved for the single workshop administrator.
 */
export function LoginModal({ onClose, open }: LoginModalProps) {
  const { signInAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await signInAdmin({ email, password });
      window.location.assign('/app/admin');
    } catch {
      setBusy(false);
      setError(true);
    }
  };

  return (
    <Modal
      eyebrow="Tu cuenta"
      onClose={onClose}
      open={open}
      title="Iniciar sesión"
    >
      <p className="text-muted mt-2 text-sm">
        Clientes acceden con Google. La cuenta local está reservada para la
        administración del taller.
      </p>

      <button
        className="bg-lead-hover text-foreground mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 px-4 py-3 text-sm font-bold transition hover:brightness-110"
        onClick={() => window.location.assign(GOOGLE_LOGIN_URL)}
        type="button"
      >
        <GoogleMark />
        Acceder con Google
      </button>

      <div className="text-muted my-6 flex items-center gap-3 text-[10px] font-semibold tracking-[0.12em] uppercase">
        <span className="h-px flex-1 bg-white/10" />o
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <p className="text-sm font-semibold">Acceso administrador</p>
        <label className="block">
          <span className="text-sm font-semibold">Correo</span>
          <input
            autoComplete="email"
            className="bg-background focus:border-accent mt-2 w-full rounded-lg border border-white/10 px-3 py-3 text-sm outline-none"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tucorreo@ejemplo.com"
            required
            type="email"
            value={email}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Contraseña</span>
          <input
            autoComplete="current-password"
            className="bg-background focus:border-accent mt-2 w-full rounded-lg border border-white/10 px-3 py-3 text-sm outline-none"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            type="password"
            value={password}
          />
        </label>
        <button
          className="bg-primary w-full rounded-xl px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
          disabled={busy}
          type="submit"
        >
          {busy ? 'Entrando…' : 'Iniciar sesión'}
        </button>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            Correo o contraseña incorrectos.
          </p>
        )}
      </form>
    </Modal>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.92v2.33A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.92a9 9 0 0 0 0 8.1l3.06-2.33Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 .92 4.95l3.06 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
