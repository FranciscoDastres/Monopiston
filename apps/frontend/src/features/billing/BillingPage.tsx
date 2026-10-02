import type { Invoice } from '@monopiston/contracts';
import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { formatCLP } from '../../components/ui/money';
import { PageHeader } from '../../components/ui/PageHeader';
import { apiClient } from '../../lib/api-client';

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeZone: 'America/Santiago',
});
const column = createColumnHelper<Invoice>();
const columns = [
  column.accessor('issuedAt', {
    header: 'Fecha',
    cell: (info) => dateFormatter.format(new Date(info.getValue())),
  }),
  column.accessor('services', {
    header: 'Servicio',
    cell: (info) => (
      <span className="font-semibold">{info.getValue().join(', ')}</span>
    ),
  }),
  column.accessor('amount', {
    header: 'Monto',
    cell: (info) => (
      <span className="tabular-nums">{formatCLP(info.getValue())}</span>
    ),
  }),
  column.accessor('paymentStatus', {
    header: 'Estado',
    cell: (info) => <PaymentBadge status={info.getValue()} />,
  }),
  column.display({
    id: 'download',
    header: 'Documento',
    cell: ({ row }) => <DownloadLink invoice={row.original} />,
  }),
];

export function BillingPage() {
  const invoices = useQuery({
    queryFn: () => apiClient.get<Invoice[]>('/v1/invoices'),
    queryKey: ['customer', 'invoices'],
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table intentionally owns its mutable table instance.
  const table = useReactTable({
    columns,
    data: invoices.data ?? [],
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div>
      <PageHeader
        eyebrow="Mi NAVI"
        subtitle="Consulta tus pagos y descarga los comprobantes asociados a cada atención."
        title="Pagos y boletas"
      />
      {invoices.isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
      ) : !invoices.data?.length ? (
        <EmptyState
          icon="receipt"
          title="Aún no hay documentos"
          description="Los comprobantes aparecerán cuando el taller finalice una atención."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-white/8 md:block">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.035]">
                <tr>
                  {table.getHeaderGroups()[0]?.headers.map((header) => (
                    <th
                      className="text-muted px-4 py-3 text-left text-[0.65rem] font-bold tracking-wider uppercase"
                      key={header.id}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr className="border-t border-white/8" key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td className="px-4 py-4" key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {invoices.data.map((invoice) => (
              <article
                className="bg-surface rounded-2xl border border-white/8 p-4"
                key={invoice.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {invoice.services.join(', ')}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      {dateFormatter.format(new Date(invoice.issuedAt))} ·{' '}
                      {invoice.documentNumber}
                    </p>
                  </div>
                  <PaymentBadge status={invoice.paymentStatus} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3">
                  <p className="font-bold">{formatCLP(invoice.amount)}</p>
                  <DownloadLink invoice={invoice} />
                </div>
              </article>
            ))}
          </div>
          <p className="text-muted mt-4 text-xs">
            Los PDFs disponibles son comprobantes de servicio no tributarios.
          </p>
        </>
      )}
    </div>
  );
}

function PaymentBadge({ status }: { status: Invoice['paymentStatus'] }) {
  return (
    <Badge tone={status === 'paid' ? 'success' : 'warning'}>
      {status === 'paid' ? 'Pagado' : 'Pendiente'}
    </Badge>
  );
}
function DownloadLink({ invoice }: { invoice: Invoice }) {
  return (
    <a
      className="text-primary hover:bg-primary/10 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase"
      download
      href={`/v1/invoices/${invoice.id}/pdf`}
    >
      <Icon className="size-4" name="download" />
      Descargar PDF
    </a>
  );
}
