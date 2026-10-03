import { render, screen } from '@testing-library/react';

import { RevenueAreaChart, StatusDonutChart } from './DashboardCharts';

describe('native dashboard charts', () => {
  it('shows the exact daily amounts and keeps single-day and zero data finite', () => {
    const { container, rerender } = render(
      <RevenueAreaChart data={[{ date: '02 oct', ingresos: 24990 }]} />,
    );
    expect(
      screen.getByRole('img', { name: 'Gráfico de ingresos diarios' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /24.990/ })).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    rerender(
      <RevenueAreaChart
        data={[
          { date: '02 oct', ingresos: 0 },
          { date: '03 oct', ingresos: 0 },
        ]}
      />,
    );
    expect(screen.getAllByRole('cell', { name: '$0' })).toHaveLength(2);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('renders every status, proportional segments and the total', () => {
    const { container } = render(
      <StatusDonutChart
        data={[
          { name: 'Confirmadas', value: 3 },
          { name: 'Completadas', value: 1 },
          { name: 'Canceladas', value: 0 },
          { name: 'En servicio', value: 0 },
          { name: 'Listas', value: 0 },
          { name: 'Recibidas', value: 0 },
          { name: 'Pendientes de pago', value: 0 },
        ]}
      />,
    );
    expect(screen.getByText('Pendientes de pago')).toBeInTheDocument();
    expect(container.querySelectorAll('circle[pathLength="100"]')).toHaveLength(
      2,
    );
    expect(
      container.querySelector('circle[stroke-dasharray="75 25"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('circle[stroke-dasharray="25 75"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveTextContent('4citas');
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('handles empty revenue and an all-zero distribution without invalid SVG', () => {
    const { container } = render(
      <>
        <RevenueAreaChart data={[]} />
        <StatusDonutChart data={[{ name: 'Confirmadas', value: 0 }]} />
      </>,
    );
    expect(
      screen.getByText('Sin ingresos en este período.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Sin citas en este período.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });
});
