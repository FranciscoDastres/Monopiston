import {
  AdminLoginSchema,
  type CurrentUser,
  UpdateProfileSchema,
} from '@monopiston/contracts';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { SessionService } from '../application/session-service.js';
import type {
  GoogleOidcClient,
  OAuthFlowState,
} from '../infrastructure/google-oidc.js';

const SESSION_COOKIE = 'drp_session';
const OAUTH_FLOW_COOKIE = 'drp_oauth_flow';
const OAUTH_FLOW_TTL_SECONDS = 10 * 60;

const oauthFlowSchema = z.object({
  codeVerifier: z.string().min(32),
  nonce: z.string().min(8),
  returnTo: z.string(),
  state: z.string().min(8),
});

export interface AuthRoutesOptions {
  allowDevLogin?: boolean;
  apiOrigin: string;
  appOrigin: string;
  google?: GoogleOidcClient;
  secureCookies: boolean;
  sessions: SessionService;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/google', async (request, reply) => {
    const query = z
      .object({ returnTo: z.string().optional() })
      .safeParse(request.query);
    const returnTo = sanitizeReturnTo(
      query.success ? query.data.returnTo : undefined,
    );

    if (!options.google) {
      // No Google credentials in local dev: sign in as a developer user
      // and continue to the requested page so the app is usable offline.
      if (options.allowDevLogin) {
        const session = await options.sessions.loginAsDeveloper({
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
        setSessionCookie(
          reply,
          session.token,
          session.expiresAt,
          options.secureCookies,
        );
        return reply.redirect(new URL(returnTo, options.appOrigin).href);
      }
      return reply.status(503).send({ error: 'google_auth_not_configured' });
    }

    const authorization =
      await options.google.createAuthorizationRequest(returnTo);

    reply.setCookie(OAUTH_FLOW_COOKIE, encodeFlow(authorization.flow), {
      httpOnly: true,
      maxAge: OAUTH_FLOW_TTL_SECONDS,
      path: '/v1/auth/google/callback',
      sameSite: 'lax',
      secure: options.secureCookies,
      signed: true,
    });

    return reply.redirect(authorization.url.href);
  });

  app.get('/google/callback', async (request, reply) => {
    if (!options.google) {
      return reply.status(503).send({ error: 'google_auth_not_configured' });
    }

    const flow = readFlowCookie(request);
    reply.clearCookie(OAUTH_FLOW_COOKIE, { path: '/v1/auth/google/callback' });

    if (!flow) {
      return reply.status(400).send({ error: 'invalid_oauth_state' });
    }

    try {
      const currentUrl = new URL(request.url, options.apiOrigin);
      const profile = await options.google.consumeCallback(currentUrl, flow);
      const session = await options.sessions.loginWithGoogle(profile, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      setSessionCookie(
        reply,
        session.token,
        session.expiresAt,
        options.secureCookies,
      );
      return reply.redirect(new URL(flow.returnTo, options.appOrigin).href);
    } catch (error) {
      request.log.warn({ err: error }, 'Google authentication failed');
      return reply.status(401).send({ error: 'authentication_failed' });
    }
  });

  app.post(
    '/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      if (!hasTrustedOrigin(request, options.appOrigin)) {
        return reply.status(403).send({ error: 'invalid_origin' });
      }
      const input = AdminLoginSchema.safeParse(request.body);
      if (!input.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }

      const session = await options.sessions.loginAsAdmin(
        input.data.email,
        input.data.password,
        {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      );
      if (!session) {
        return reply.status(401).send({ error: 'invalid_credentials' });
      }

      setSessionCookie(
        reply,
        session.token,
        session.expiresAt,
        options.secureCookies,
      );
      const response: CurrentUser = session.user;
      return reply.send(response);
    },
  );

  app.post('/dev-login', async (request, reply) => {
    if (!options.allowDevLogin) {
      return reply.status(404).send({ error: 'not_found' });
    }

    const session = await options.sessions.loginAsDeveloper({
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    setSessionCookie(
      reply,
      session.token,
      session.expiresAt,
      options.secureCookies,
    );

    const response: CurrentUser = session.user;
    return reply.send(response);
  });

  app.get('/me', async (request, reply) => {
    const user = await options.sessions.authenticate(
      request.cookies[SESSION_COOKIE],
    );
    if (!user) return reply.status(401).send({ error: 'unauthorized' });

    const response: CurrentUser = user;
    return reply.send(response);
  });

  app.patch('/me', async (request, reply) => {
    if (!hasTrustedOrigin(request, options.appOrigin)) {
      return reply.status(403).send({ error: 'invalid_origin' });
    }
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;

    const input = UpdateProfileSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }

    const updated = await options.sessions.updateProfile(user.id, {
      displayName: input.data.displayName,
      phone: input.data.phone ?? null,
    });
    const response: CurrentUser = updated;
    return reply.send(response);
  });

  app.post('/logout', async (request, reply) => {
    if (!hasTrustedOrigin(request, options.appOrigin)) {
      return reply.status(403).send({ error: 'invalid_origin' });
    }

    await options.sessions.logout(request.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  // Derecho de supresión (Ley 21.719): el cliente elimina su cuenta. Anonimiza
  // sus datos personales y revoca sus sesiones; las boletas se conservan por
  // obligación tributaria. El administrador (operador del negocio) no puede
  // autoeliminarse por esta vía.
  app.delete('/me', async (request, reply) => {
    if (!hasTrustedOrigin(request, options.appOrigin)) {
      return reply.status(403).send({ error: 'invalid_origin' });
    }
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;
    if (user.role === 'admin') {
      return reply.status(403).send({ error: 'admin_cannot_self_delete' });
    }

    await options.sessions.deleteAccount(user.id);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  // "Cerrar sesión en todos los dispositivos": revoca todas las sesiones del
  // usuario autenticado, no solo la actual.
  app.post('/logout-all', async (request, reply) => {
    if (!hasTrustedOrigin(request, options.appOrigin)) {
      return reply.status(403).send({ error: 'invalid_origin' });
    }
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;

    await options.sessions.revokeAllSessions(user.id);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });
};

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  sessions: SessionService,
) {
  const user = await sessions.authenticate(request.cookies[SESSION_COOKIE]);
  if (!user) {
    await reply.status(401).send({ error: 'unauthorized' });
    return null;
  }
  return user;
}

export function hasTrustedOrigin(
  request: FastifyRequest,
  appOrigin: string,
): boolean {
  return request.headers.origin === appOrigin;
}

function encodeFlow(flow: OAuthFlowState): string {
  return Buffer.from(JSON.stringify(flow)).toString('base64url');
}

function readFlowCookie(request: FastifyRequest): OAuthFlowState | null {
  const cookie = request.cookies[OAUTH_FLOW_COOKIE];
  if (!cookie) return null;
  const unsigned = request.unsignCookie(cookie);
  if (!unsigned.valid) return null;

  try {
    return oauthFlowSchema.parse(
      JSON.parse(Buffer.from(unsigned.value, 'base64url').toString('utf8')),
    );
  } catch {
    return null;
  }
}

function sanitizeReturnTo(returnTo: string | undefined): string {
  if (!returnTo?.startsWith('/') || returnTo.startsWith('//')) return '/';
  return returnTo;
}

function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
  secure: boolean,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure,
  });
}
