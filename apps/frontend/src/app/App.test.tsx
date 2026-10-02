import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { App } from './App';

describe('App', () => {
  it('renders the product proposition', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string) => {
        if (input.includes('/v1/auth/me')) {
          return {
            headers: { get: () => 'application/json' },
            json: async () => ({ error: 'unauthorized' }),
            ok: false,
            status: 401,
          };
        }

        return {
          headers: { get: () => 'application/json' },
          json: async () => ({ service: 'monopiston-api', status: 'ok' }),
          ok: true,
          status: 200,
        };
      }),
    );

    render(<App />);

    expect(
      screen.getByRole('heading', { name: /tu navi lista para/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute(
      'href',
      '/v1/auth/google?returnTo=/app',
    );
    expect(
      screen.getAllByRole('link', { name: 'Agendar una cita' })[0],
    ).toHaveAttribute('href', '/v1/auth/google?returnTo=/app/appointments');
    expect(
      screen.getAllByRole('img', { name: 'Taller Mono Pistón' }),
    ).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/health/'),
      expect.anything(),
    );

    // These dialogs are now lazy: opening one must preserve the existing entry point.
    fireEvent.click(screen.getByRole('link', { name: 'Mi cuenta' }));
    expect(
      await screen.findByRole('dialog', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    vi.unstubAllGlobals();
  });
});
