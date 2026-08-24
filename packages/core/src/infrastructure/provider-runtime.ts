import { z } from "zod";

import type { ProviderStatus } from "../domain/models";

export class ProviderFailure extends Error {
  public constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode: number | null = null,
  ) {
    super(message);
    this.name = "ProviderFailure";
  }
}

interface RuntimeStatus {
  available: boolean;
  latencyMs: number | null;
  detail: string | null;
}

export class ProviderRuntime {
  private readonly statuses = new Map<string, RuntimeStatus>();
  private readonly lastStartByProvider = new Map<string, number>();

  public constructor(private readonly minIntervalMs = 100) {}

  public async execute<T>(provider: string, operation: () => Promise<T>): Promise<T> {
    await this.throttle(provider);
    const startedAt = performance.now();
    try {
      const result = await operation();
      this.statuses.set(provider, {
        available: true,
        latencyMs: Math.round(performance.now() - startedAt),
        detail: null,
      });
      return result;
    } catch (error) {
      const detail =
        error instanceof Error ? error.message.slice(0, 240) : "Unexpected provider failure";
      this.statuses.set(provider, {
        available: false,
        latencyMs: Math.round(performance.now() - startedAt),
        detail,
      });
      throw error;
    }
  }

  public getStatus(): readonly ProviderStatus[] {
    return [...this.statuses.entries()].map(([provider, status]) => ({ provider, ...status }));
  }

  private async throttle(provider: string): Promise<void> {
    const now = Date.now();
    const lastStartedAt = this.lastStartByProvider.get(provider) ?? 0;
    const waitMs = this.minIntervalMs - (now - lastStartedAt);
    this.lastStartByProvider.set(provider, now + Math.max(waitMs, 0));
    if (waitMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export async function fetchValidatedJson<T>(
  provider: string,
  url: string,
  schema: z.ZodType<T>,
  options: { timeoutMs?: number; headers?: HeadersInit } = {},
): Promise<T> {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:") {
    throw new ProviderFailure("Provider endpoint must use HTTPS", provider);
  }

  const timeoutMs = options.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(parsedUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new ProviderFailure(
        `Provider returned HTTP ${response.status}`,
        provider,
        response.status,
      );
    }

    const payload: unknown = await response.json();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ProviderFailure("Provider returned an unexpected response shape", provider);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ProviderFailure) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProviderFailure(`Provider request timed out after ${timeoutMs}ms`, provider);
    }
    throw new ProviderFailure("Provider request failed", provider);
  } finally {
    clearTimeout(timer);
  }
}
