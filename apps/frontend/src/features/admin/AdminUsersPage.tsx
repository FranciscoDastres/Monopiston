import type {
  AdminUser,
  CreateAdminUserInput,
  UpdateUserInput,
} from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, Input } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { formatCLP } from '../../components/ui/money';
import { PageHeader } from '../../components/ui/PageHeader';
import { type Column, Table } from '../../components/ui/Table';
import { apiClient } from '../../lib/api-client';

interface UserFormState {
  displayName: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: UserFormState = { displayName: '', email: '', phone: '' };

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const usersQuery = useQuery({
    queryFn: () => apiClient.get<AdminUser[]>('/v1/admin/users'),
    queryKey: ['admin', 'users'],
  });
  const refreshUsers = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const createMutation = useMutation({
    mutationFn: (input: CreateAdminUserInput) =>
      apiClient.post<AdminUser>('/v1/admin/users', input),
    onSuccess: async () => {
      closeForm();
      await refreshUsers();
    },
    onError: () =>
      setFormError(
        'No fue posible crear el usuario. Verifica que el correo no esté registrado.',
      ),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      apiClient.patch<AdminUser>(`/v1/admin/users/${id}`, input),
    onSuccess: async () => {
      closeForm();
      await refreshUsers();
    },
    onError: () => setFormError('No fue posible guardar los cambios.'),
  });
  const toggleMutation = useMutation({
    mutationFn: (user: AdminUser) =>
      apiClient.patch<AdminUser>(`/v1/admin/users/${user.id}`, {
        isActive: !user.isActive,
      }),
    onSuccess: refreshUsers,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/admin/users/${id}`),
    onSuccess: async () => {
      setDeletingUser(null);
      await refreshUsers();
    },
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-CL');
    if (!term) return users;
    return users.filter((user) =>
      [user.displayName, user.email, user.phone ?? ''].some((value) =>
        value.toLocaleLowerCase('es-CL').includes(term),
      ),
    );
  }, [search, users]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };
  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setForm({
      displayName: user.displayName,
      email: user.email,
      phone: user.phone ?? '',
    });
    setFormError('');
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };
  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const input = {
      displayName: form.displayName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
    };
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, input });
    } else {
      createMutation.mutate(input);
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      cell: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-full text-xs font-black">
            {initials(user.displayName)}
          </span>
          <div className="min-w-0">
            <p className="text-foreground truncate font-semibold">
              {user.displayName}
            </p>
            <p className="text-muted truncate text-xs">{user.email}</p>
          </div>
        </div>
      ),
      header: 'Cliente',
    },
    {
      cell: (user) => (
        <span className="text-muted">{user.phone ?? 'Sin teléfono'}</span>
      ),
      header: 'Contacto',
    },
    { align: 'right', cell: (user) => user.appointmentCount, header: 'Citas' },
    {
      align: 'right',
      cell: (user) => (
        <span className="font-semibold tabular-nums">
          {formatCLP(user.totalSpent)}
        </span>
      ),
      header: 'Total',
    },
    {
      cell: (user) => (
        <Badge tone={user.isActive ? 'success' : 'danger'}>
          {user.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      header: 'Estado',
    },
    {
      align: 'right',
      cell: (user) =>
        user.isPrimaryAdmin ? (
          <Badge tone="primary">Admin principal</Badge>
        ) : (
          <div className="flex justify-end gap-1">
            <button
              aria-label={`Editar ${user.displayName}`}
              className="text-muted hover:text-foreground grid size-9 place-items-center rounded-lg hover:bg-white/5"
              onClick={() => openEdit(user)}
              type="button"
            >
              <Icon className="size-4" name="edit" />
            </button>
            <button
              aria-label={`${user.isActive ? 'Desactivar' : 'Activar'} ${user.displayName}`}
              className="text-muted hover:text-foreground grid size-9 place-items-center rounded-lg hover:bg-white/5"
              disabled={toggleMutation.isPending}
              onClick={() => toggleMutation.mutate(user)}
              type="button"
            >
              <Icon
                className="size-4"
                name={user.isActive ? 'close' : 'check'}
              />
            </button>
            <button
              aria-label={`Eliminar ${user.displayName}`}
              className="grid size-9 place-items-center rounded-lg text-red-400 hover:bg-red-500/10"
              onClick={() => setDeletingUser(user)}
              type="button"
            >
              <Icon className="size-4" name="trash" />
            </button>
          </div>
        ),
      header: '',
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        subtitle="Clientes registrados, actividad y permisos."
        title="Usuarios"
        actions={
          <Button icon="plus" onClick={openCreate}>
            Nuevo usuario
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Buscar usuarios</span>
          <Icon
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            name="search"
          />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo o teléfono"
            value={search}
          />
        </label>
        <p className="text-muted text-xs">{filteredUsers.length} registros</p>
      </div>

      {usersQuery.isLoading ? (
        <div className="bg-surface h-72 animate-pulse rounded-2xl border border-white/8" />
      ) : users.length === 0 ? (
        <EmptyState
          icon="users"
          title="Aún no hay usuarios"
          description="Crea el primer cliente para comenzar."
        />
      ) : (
        <Table
          columns={columns}
          empty="No hay coincidencias."
          rowKey={(user) => user.id}
          rows={filteredUsers}
        />
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        eyebrow="Gestión de usuarios"
        title={editingUser ? 'Editar usuario' : 'Nuevo usuario'}
      >
        <form className="space-y-4" onSubmit={submitForm}>
          <Field label="Nombre completo">
            <Input
              autoFocus
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
              required
              value={form.displayName}
            />
          </Field>
          <Field label="Correo electrónico">
            <Input
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              required
              type="email"
              value={form.email}
            />
          </Field>
          <Field
            hint="Usa formato internacional, por ejemplo +56912345678."
            label="Teléfono"
          >
            <Input
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              type="tel"
              value={form.phone}
            />
          </Field>
          {formError && (
            <p className="text-sm text-red-400" role="alert">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={closeForm} variant="ghost">
              Cancelar
            </Button>
            <Button
              loading={createMutation.isPending || updateMutation.isPending}
              type="submit"
            >
              {editingUser ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        eyebrow="Acción irreversible"
        title="Eliminar usuario"
        footer={
          <>
            <Button onClick={() => setDeletingUser(null)} variant="ghost">
              Cancelar
            </Button>
            <Button
              loading={deleteMutation.isPending}
              onClick={() =>
                deletingUser && deleteMutation.mutate(deletingUser.id)
              }
              variant="danger"
            >
              Eliminar usuario
            </Button>
          </>
        }
      >
        <p className="text-muted text-sm">
          Se eliminarán los datos personales de{' '}
          <strong className="text-foreground">
            {deletingUser?.displayName}
          </strong>{' '}
          y se cerrarán sus sesiones. Las citas históricas se conservarán
          anonimizadas para no alterar las métricas.
        </p>
        {deleteMutation.isError && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            No fue posible eliminar este usuario.
          </p>
        )}
      </Modal>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
