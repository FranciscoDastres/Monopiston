import { createHash, randomBytes } from 'node:crypto';

import type {
  AuthRepository,
  AuthUser,
  GoogleProfile,
  ProfileUpdate,
  SessionMetadata,
} from '../domain/auth.js';
import { verifyPassword } from '../infrastructure/password.js';

const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface CreatedSession {
  expiresAt: Date;
  token: string;
  user: AuthUser;
}

export class SessionService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly sessionTtlMs = DEFAULT_SESSION_TTL_MS,
  ) {}

  async authenticate(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
    return this.repository.findUserBySessionHash(hashSessionToken(token));
  }

  async loginWithGoogle(
    profile: GoogleProfile,
    metadata: SessionMetadata,
  ): Promise<CreatedSession> {
    const user = await this.repository.upsertGoogleUser(profile);
    return this.createSession(user, metadata);
  }

  async loginAsAdmin(
    email: string,
    password: string,
    metadata: SessionMetadata,
  ): Promise<CreatedSession | null> {
    const credentials = await this.repository.findLocalAdminByEmail(
      email.trim().toLowerCase(),
    );
    if (!(await verifyPassword(password, credentials?.passwordHash ?? null))) {
      return null;
    }
    if (!credentials) return null;
    return this.createSession(credentials.user, metadata);
  }

  async loginAsDeveloper(metadata: SessionMetadata): Promise<CreatedSession> {
    const user = await this.repository.upsertDeveloperUser();
    return this.createSession(user, metadata);
  }

  private async createSession(
    user: AuthUser,
    metadata: SessionMetadata,
  ): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);

    await this.repository.createSession(
      user.id,
      hashSessionToken(token),
      expiresAt,
      metadata,
    );

    return { expiresAt, token, user };
  }

  async updateProfile(
    userId: string,
    update: ProfileUpdate,
  ): Promise<AuthUser> {
    return this.repository.updateProfile(userId, update);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.repository.revokeSession(hashSessionToken(token));
  }

  // Revokes every active session of a user ("log out of all devices"). Returns
  // how many sessions were revoked.
  async revokeAllSessions(userId: string): Promise<number> {
    return this.repository.revokeAllSessionsForUser(userId);
  }

  // Derecho de supresión (Ley 21.719): anonymizes the user's personal data and
  // revokes their sessions. Financial records (invoices) are retained to comply
  // with tax-retention obligations.
  async deleteAccount(userId: string): Promise<void> {
    await this.repository.anonymizeUserAccount(userId);
  }
}

function hashSessionToken(token: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(createHash('sha256').update(token).digest());
}
