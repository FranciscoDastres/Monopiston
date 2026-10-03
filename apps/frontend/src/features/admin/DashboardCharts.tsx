import { useId } from 'react';

import { formatCLP } from '../../components/ui/money';

const CHART_COLORS = [
  '#ff2948',
  '#39e991',
  '#ffb84d',
  '#9ba8ba',
  '#b9a6ff',
  '#64d8ee',
  '#ff9d76',
  '#e5df8c',
  '#df9fca',
];

/** Native SVG and an expandable data table keep daily amounts accessible. */
export function RevenueAreaChart({
  data,
}: {
  data: Array<{ date: string; ingresos: number }>;
}) {
  const gradientId = useId();
  if (!data.length)
    return (
      <p className="text-muted mt-8 text-sm">Sin ingresos en este período.</p>
    );

  const width = 600;
  const left = 76;
  const right = width - 16;
  const top = 18;
  const bottom = 206;
  const max = Math.max(1, ...data.map((item) => item.ingresos));
  const points = data.map((item, index) => ({
    ...item,
    x:
      data.length === 1
        ? (left + right) / 2
        : left + (index / (data.length - 1)) * (right - left),
    y: bottom - (item.ingresos / max) * (bottom - top),
  }));
  const line = points
    .map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`)
    .join(' ');
  const area = `${line} L${points[points.length - 1]!.x},${bottom} L${points[0]!.x},${bottom} Z`;
  const labelStep = Math.max(1, Math.ceil((points.length - 1) / 4));

  return (
    <figure className="mt-5">
      <svg
        aria-label="Gráfico de ingresos diarios"
        className="h-auto w-full"
        role="img"
        viewBox="0 0 600 250"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff2948" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ff2948" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = bottom - fraction * (bottom - top);
          return (
            <g key={fraction}>
              <line
                stroke="rgb(255 255 255 / 10%)"
                x1={left}
                x2={right}
                y1={y}
                y2={y}
              />
              <text
                className="fill-muted text-[11px]"
                textAnchor="end"
                x={left - 10}
                y={y + 4}
              >
                {formatCLP(max * fraction)}
              </text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="#ff2948"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        {points.map((point, index) => (
          <g key={point.date}>
            <circle
              cx={point.x}
              cy={point.y}
              fill="#ff2948"
              r={data.length === 1 ? 4 : 2}
            />
            <circle cx={point.x} cy={point.y} fill="transparent" r="8">
              <title>{`${point.date}: ${formatCLP(point.ingresos)}`}</title>
            </circle>
            {(index % labelStep === 0 || index === points.length - 1) && (
              <text
                className="fill-muted text-[11px]"
                textAnchor={index === points.length - 1 ? 'end' : 'start'}
                x={point.x}
                y="232"
              >
                {point.date}
              </text>
            )}
          </g>
        ))}
      </svg>
      <details className="text-muted mt-3 text-xs">
        <summary className="hover:text-foreground cursor-pointer py-2">
          Ver ingresos por día
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">
              Ingresos diarios del período seleccionado
            </caption>
            <thead>
              <tr>
                <th className="py-2" scope="col">
                  Fecha
                </th>
                <th className="py-2 text-right" scope="col">
                  Ingresos
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr className="border-t border-white/10" key={item.date}>
                  <th className="py-2 font-normal" scope="row">
                    {item.date}
                  </th>
                  <td className="py-2 text-right">
                    {formatCLP(item.ingresos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function StatusDonutChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0)
    return (
      <p className="text-muted mt-8 text-sm">Sin citas en este período.</p>
    );
  const segments = data.reduce<
    Array<{ name: string; value: number; percent: number; offset: number }>
  >((result, item) => {
    const previous = result[result.length - 1];
    result.push({
      ...item,
      percent: (item.value / total) * 100,
      offset: previous ? previous.offset + previous.percent : 0,
    });
    return result;
  }, []);

  return (
    <figure>
      <svg
        aria-label="Distribución de citas por estado"
        className="mx-auto my-4 size-44"
        role="img"
        viewBox="0 0 200 200"
      >
        <circle
          cx="100"
          cy="100"
          fill="none"
          r="68"
          stroke="rgb(255 255 255 / 10%)"
          strokeWidth="24"
        />
        {segments
          .filter((item) => item.value > 0)
          .map((item) => (
            <circle
              cx="100"
              cy="100"
              fill="none"
              key={item.name}
              pathLength="100"
              r="68"
              stroke={
                CHART_COLORS[
                  data.findIndex((entry) => entry.name === item.name) %
                    CHART_COLORS.length
                ]
              }
              strokeDasharray={`${item.percent} ${100 - item.percent}`}
              strokeDashoffset={-item.offset}
              strokeWidth="24"
              transform="rotate(-90 100 100)"
            >
              <title>{`${item.name}: ${item.value} (${Math.round(item.percent)}%)`}</title>
            </circle>
          ))}
        <text
          className="fill-foreground text-3xl font-bold"
          textAnchor="middle"
          x="100"
          y="101"
        >
          {total}
        </text>
        <text
          className="fill-muted text-xs"
          textAnchor="middle"
          x="100"
          y="123"
        >
          citas
        </text>
      </svg>
      <figcaption className="grid grid-cols-2 gap-2">
        {data.map((item, index) => (
          <div
            className="flex min-w-0 items-center gap-2 text-xs"
            key={item.name}
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="text-muted truncate" title={item.name}>
              {item.name}
            </span>
            <span className="ml-auto font-semibold tabular-nums">
              {item.value}
            </span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}
