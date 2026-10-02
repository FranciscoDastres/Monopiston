type UserRole = 'customer' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  phone: string | null;
  role: UserRole;
}

export interface ProfileUpdate {
  displayName: string;
  phone: string | null;
}

export interface GoogleProfile {
  subject: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SessionMetadata {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface LocalAdminCredentials {
  passwordHash: string;
  user: AuthUser;
}

export interface AuthRepository {
  anonymizeUserAccount(userId: string): Promise<void>;
  createSession(
    userId: string,
    tokenHash: Uint8Array<ArrayBuffer>,
    expiresAt: Date,
    metadata: SessionMetadata,
  ): Promise<void>;
  findUserBySessionHash(
    tokenHash: Uint8Array<ArrayBuffer>,
  ): Promise<AuthUser | null>;
  findLocalAdminByEmail(email: string): Promise<LocalAdminCredentials | null>;
  revokeSession(tokenHash: Uint8Array<ArrayBuffer>): Promise<void>;
  revokeAllSessionsForUser(userId: string): Promise<number>;
  updateProfile(userId: string, update: ProfileUpdate): Promise<AuthUser>;
  upsertGoogleUser(profile: GoogleProfile): Promise<AuthUser>;
  upsertDeveloperUser(): Promise<AuthUser>;
}
