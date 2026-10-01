import { TZDate } from '@date-fns/tz';
import type {
  AdminMetrics,
  AdminMetricsFilters,
  AdminUser,
  CreateAdminUserInput,
  UpdateUserInput,
} from '@monopiston/contracts';
import type { DatabaseClient } from '@monopiston/database';

const WORKSHOP_TIME_ZONE = 'America/Santiago';

export class AdminUserError extends Error {}

export class AdminService {
  constructor(private readonly database: DatabaseClient) {}

  async listUsers(): Promise<AdminUser[]> {
    const [users, completed] = await Promise.all([
      this.database.users.findMany({
        include: { _count: { select: { appointments: true } } },
        orderBy: { created_at: 'desc' },
        where: { deleted_at: null },
      }),
      this.database.appointments.findMany({
        select: {
          appointment_services: {
            select: { quantity: true, unit_price_cents: true },
          },
          customer_user_id: true,
        },
        where: { status: 'completed' },
      }),
    ]);

    const spentByUser = new Map<string, number>();
    for (const appointment of completed) {
      const total = appointment.appointment_services.reduce(
        (sum, service) => sum + service.unit_price_cents * service.quantity,
        0,
      );
      spentByUser.set(
        appointment.customer_user_id,
        (spentByUser.get(appointment.customer_user_id) ?? 0) + total,
      );
    }

    return users.map((user) => ({
      appointmentCount: user._count.appointments,
      createdAt: user.created_at.toISOString(),
      displayName: user.display_name,
      email: user.email,
      id: user.id,
      isActive: user.is_active,
      isPrimaryAdmin: user.role === 'admin',
      phone: user.phone,
      role: user.role,
      totalSpent: spentByUser.get(user.id) ?? 0,
    }));
  }

  async createUser(input: CreateAdminUserInput): Promise<AdminUser> {
    try {
      const created = await this.database.users.create({
        data: {
          display_name: input.displayName,
          email: input.email,
          phone: input.phone,
          role: 'customer',
        },
        select: { id: true },
      });
      return await this.getUser(created.id);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AdminUserError('email_already_exists');
      }
      throw error;
    }
  }

  async updateUser(
    actorUserId: string,
    userId: string,
    input: UpdateUserInput,
  ): Promise<AdminUser> {
    const target = await this.database.users.findUnique({
      where: { id: userId },
    });
    if (!target || target.deleted_at)
      throw new AdminUserError('user_not_found');

    // The only administrator cannot be disabled or changed from the client UI.
    if (target.role === 'admin') {
      throw new AdminUserError('cannot_modify_primary_admin');
    }
    if (actorUserId === userId && input.isActive === false) {
      throw new AdminUserError('cannot_disable_self');
    }

    try {
      await this.database.users.update({
        data: {
          ...(input.displayName !== undefined && {
            display_name: input.displayName,
          }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.isActive !== undefined && { is_active: input.isActive }),
          ...(input.phone !== undefined && { phone: input.phone }),
        },
        where: { id: userId },
      });
      return await this.getUser(userId);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AdminUserError('email_already_exists');
      }
      throw error;
    }
  }

  async deleteUser(actorUserId: string, userId: string): Promise<void> {
    const target = await this.database.users.findUnique({
      where: { id: userId },
    });
    if (!target || target.deleted_at)
      throw new AdminUserError('user_not_found');
    if (target.role === 'admin' || actorUserId === userId) {
      throw new AdminUserError('cannot_delete_admin');
    }

    await this.database.$transaction(async (transaction) => {
      await transaction.auth_sessions.updateMany({
        data: { revoked_at: new Date() },
        where: { user_id: userId, revoked_at: null },
      });
      await transaction.oauth_accounts.deleteMany({
        where: { user_id: userId },
      });
      await transaction.users.update({
        data: {
          avatar_url: null,
          deleted_at: new Date(),
          display_name: 'Usuario eliminado',
          email: `deleted-${userId}@deleted.dracingpro.invalid`,
          is_active: false,
          password_hash: null,
          phone: null,
        },
        where: { id: userId },
      });
      await transaction.audit_logs.create({
        data: {
          action: 'user.deleted',
          actor_user_id: actorUserId,
          entity_id: userId,
          entity_type: 'user',
        },
      });
    });
  }

  private async getUser(userId: string): Promise<AdminUser> {
    const user = (await this.listUsers()).find((item) => item.id === userId);
    if (!user) throw new AdminUserError('user_not_found');
    return user;
  }

  async getMetrics(filters: AdminMetricsFilters): Promise<AdminMetrics> {
    const dayStart = workshopDayStart(filters.from);
    const dayEnd = workshopDayStart(addDays(filters.to, 1));

    const [appointments, pendingRequests, newUsers] = await Promise.all([
      this.database.appointments.findMany({
        select: {
          appointment_services: {
            select: {
              quantity: true,
              service_name_snapshot: true,
              unit_price_cents: true,
            },
          },
          starts_at: true,
          status: true,
        },
        where: { starts_at: { gte: dayStart, lt: dayEnd } },
      }),
      this.database.appointments.count({ where: { status: 'requested' } }),
      this.database.users.findMany({
        select: { created_at: true },
        where: {
          created_at: { gte: dayStart, lt: dayEnd },
          deleted_at: null,
          role: 'customer',
        },
      }),
    ]);

    const appointmentsByStatus: Record<string, number> = {};
    const revenueByDayMap = new Map<string, number>();
    const revenueByServiceMap = new Map<string, number>();
    const newUsersByDayMap = new Map<string, number>();
    let totalRevenue = 0;
    let completedCount = 0;

    for (const appointment of appointments) {
      appointmentsByStatus[appointment.status] =
        (appointmentsByStatus[appointment.status] ?? 0) + 1;
      if (appointment.status !== 'completed') continue;

      completedCount += 1;
      const day = formatWorkshopDate(appointment.starts_at);
      let appointmentTotal = 0;
      for (const service of appointment.appointment_services) {
        const amount = service.unit_price_cents * service.quantity;
        appointmentTotal += amount;
        revenueByServiceMap.set(
          service.service_name_snapshot,
          (revenueByServiceMap.get(service.service_name_snapshot) ?? 0) +
            amount,
        );
      }
      totalRevenue += appointmentTotal;
      revenueByDayMap.set(
        day,
        (revenueByDayMap.get(day) ?? 0) + appointmentTotal,
      );
    }

    for (const user of newUsers) {
      const day = formatWorkshopDate(user.created_at);
      newUsersByDayMap.set(day, (newUsersByDayMap.get(day) ?? 0) + 1);
    }

    return {
      appointmentsByStatus,
      averageTicket: completedCount
        ? Math.round(totalRevenue / completedCount)
        : 0,
      completedCount,
      newUsersCount: newUsers.length,
      newUsersByDay: enumerateDays(filters.from, filters.to).map((date) => ({
        date,
        total: newUsersByDayMap.get(date) ?? 0,
      })),
      pendingRequests,
      revenueByDay: enumerateDays(filters.from, filters.to).map((date) => ({
        date,
        total: revenueByDayMap.get(date) ?? 0,
      })),
      revenueByService: [...revenueByServiceMap.entries()]
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6),
      totalRevenue,
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function workshopDayStart(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new TZDate(year!, month! - 1, day!, 0, 0, 0, WORKSHOP_TIME_ZONE);
}

function formatWorkshopDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: WORKSHOP_TIME_ZONE,
    year: 'numeric',
  }).format(date);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + days));
  return next.toISOString().slice(0, 10);
}

function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  // Cap to avoid runaway loops; ranges are validated to be small in practice.
  for (let i = 0; i < 366 && cursor <= to; i += 1) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}
