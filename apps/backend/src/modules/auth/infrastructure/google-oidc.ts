import * as oidc from 'openid-client';

import type { GoogleProfile } from '../domain/auth.js';

const GOOGLE_ISSUER = new URL('https://accounts.google.com');

export interface GoogleOidcSettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthFlowState {
  codeVerifier: string;
  nonce: string;
  returnTo: string;
  state: string;
}

export interface AuthorizationRequest {
  flow: OAuthFlowState;
  url: URL;
}

export class GoogleOidcClient {
  private configuration?: Promise<oidc.Configuration>;

  constructor(private readonly settings: GoogleOidcSettings) {}

  async createAuthorizationRequest(
    returnTo: string,
  ): Promise<AuthorizationRequest> {
    const configuration = await this.getConfiguration();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const nonce = oidc.randomNonce();
    const state = oidc.randomState();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const parameters = {
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      nonce,
      redirect_uri: this.settings.redirectUri,
      scope: 'openid email profile',
      state,
    };

    return {
      flow: { codeVerifier, nonce, returnTo, state },
      url: oidc.buildAuthorizationUrl(configuration, parameters),
    };
  }

  async consumeCallback(
    currentUrl: URL,
    flow: OAuthFlowState,
  ): Promise<GoogleProfile> {
    const configuration = await this.getConfiguration();
    const tokens = await oidc.authorizationCodeGrant(
      configuration,
      currentUrl,
      {
        expectedNonce: flow.nonce,
        expectedState: flow.state,
        idTokenExpected: true,
        pkceCodeVerifier: flow.codeVerifier,
      },
    );
    const claims = tokens.claims();

    if (
      !claims ||
      typeof claims.sub !== 'string' ||
      typeof claims.email !== 'string' ||
      claims.email_verified !== true
    ) {
      throw new Error('Google did not return a verified email identity');
    }

    return {
      avatarUrl: typeof claims.picture === 'string' ? claims.picture : null,
      displayName:
        typeof claims.name === 'string' && claims.name.trim()
          ? claims.name
          : (claims.email.split('@')[0] ?? 'Cliente Taller Mono Pistón'),
      email: claims.email,
      subject: claims.sub,
    };
  }

  private getConfiguration(): Promise<oidc.Configuration> {
    this.configuration ??= oidc.discovery(
      GOOGLE_ISSUER,
      this.settings.clientId,
      this.settings.clientSecret,
    );
    return this.configuration;
  }
}
