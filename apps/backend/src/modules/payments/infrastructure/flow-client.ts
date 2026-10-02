import { createHmac } from 'node:crypto';

export interface FlowConfig {
  apiBase: string;
  apiKey: string;
  secretKey: string;
}

export interface FlowCreatePaymentInput {
  amount: number;
  commerceOrder: string;
  currency: string;
  email: string;
  subject: string;
  urlConfirmation: string;
  urlReturn: string;
}

export interface FlowCreatePaymentResult {
  flowOrder: string;
  redirectUrl: string;
  token: string;
  url: string;
}

export interface FlowStatusResult {
  amount: number;
  commerceOrder: string;
  flowOrder: string;
  status: number;
}

// Flow status codes: 1=pending, 2=paid, 3=rejected, 4=canceled.
export function isPaidFlowStatus(status: number): boolean {
  return status === 2;
}

// Flow signs requests by concatenating the parameters sorted by name as
// "name1value1name2value2..." and producing an HMAC-SHA256 hex digest with the
// secret key. The signature travels in the `s` parameter.
/** @testonly Exported to verify Flow signature compatibility directly. */
export function signFlowParams(
  params: Record<string, string>,
  secretKey: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');
  return createHmac('sha256', secretKey).update(toSign).digest('hex');
}

class FlowError extends Error {}

// Flow does not sign its JSON responses, so the integrity of getStatus rests on
// TLS. Refuse a plain-http apiBase (which a MITM could use to forge a "paid"
// status); localhost is exempt for local mocks and tests.
function assertSecureApiBase(apiBase: string): void {
  let url: URL;
  try {
    url = new URL(apiBase);
  } catch {
    throw new FlowError('flow_invalid_api_base');
  }
  const isLoopback =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !isLoopback) {
    throw new FlowError('flow_insecure_api_base');
  }
}

export class FlowClient {
  constructor(private readonly config: FlowConfig) {
    assertSecureApiBase(config.apiBase);
  }

  async createPayment(
    input: FlowCreatePaymentInput,
  ): Promise<FlowCreatePaymentResult> {
    const body = await this.post('/payment/create', {
      amount: String(input.amount),
      apiKey: this.config.apiKey,
      commerceOrder: input.commerceOrder,
      currency: input.currency,
      email: input.email,
      subject: input.subject,
      urlConfirmation: input.urlConfirmation,
      urlReturn: input.urlReturn,
    });

    if (
      typeof body.url !== 'string' ||
      typeof body.token !== 'string' ||
      body.flowOrder === undefined
    ) {
      throw new FlowError('flow_create_unexpected_response');
    }

    return {
      flowOrder: String(body.flowOrder),
      redirectUrl: `${body.url}?token=${body.token}`,
      token: body.token,
      url: body.url,
    };
  }

  async getStatus(token: string): Promise<FlowStatusResult> {
    // Flow's payment/getStatus is a GET endpoint: the signed params travel in
    // the query string. Sending them as a POST body returns HTTP 400.
    const body = await this.get('/payment/getStatus', {
      apiKey: this.config.apiKey,
      token,
    });

    if (typeof body.status !== 'number') {
      throw new FlowError('flow_status_unexpected_response');
    }

    return {
      amount: Number(body.amount ?? 0),
      commerceOrder: String(body.commerceOrder ?? ''),
      flowOrder: String(body.flowOrder ?? ''),
      status: body.status,
    };
  }

  private sign(params: Record<string, string>): Record<string, string> {
    return {
      ...params,
      s: signFlowParams(params, this.config.secretKey),
    };
  }

  private async post(
    path: string,
    params: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Record<string, any>> {
    const response = await fetch(`${this.config.apiBase}${path}`, {
      body: new URLSearchParams(this.sign(params)).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    return this.parse(response);
  }

  private async get(
    path: string,
    params: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Record<string, any>> {
    const query = new URLSearchParams(this.sign(params)).toString();
    const response = await fetch(`${this.config.apiBase}${path}?${query}`, {
      method: 'GET',
    });
    return this.parse(response);
  }

  private async parse(
    response: Response,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Record<string, any>> {
    if (!response.ok) {
      throw new FlowError(`flow_http_${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
}
