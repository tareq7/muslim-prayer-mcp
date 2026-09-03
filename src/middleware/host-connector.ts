import type { PrayerStatusResult } from '../engine/types.ts';

export interface HostMiddlewareOptions {
  workerBaseUrl: string;
  userId?: string;
  timeoutMs?: number;
  authToken?: string;
}

export class PrayerReminderMiddleware {
  private workerBaseUrl: string;
  private userId: string;
  private timeoutMs: number;
  private authToken?: string;

  constructor(options: HostMiddlewareOptions) {
    this.workerBaseUrl = options.workerBaseUrl.replace(/\/+$/, '');
    this.userId = options.userId || 'default_user';
    this.timeoutMs = options.timeoutMs || 250;
    this.authToken = options.authToken;
  }

  /**
   * Fast edge check for active prayer reminder.
   * Fail-open: returns null on timeout or network issue.
   */
  async checkPrayerStatus(headers?: Record<string, string>): Promise<PrayerStatusResult | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const reqHeaders: Record<string, string> = {
        Accept: 'application/json',
        ...headers,
      };

      if (this.authToken) {
        reqHeaders['Authorization'] = `Bearer ${this.authToken}`;
      }

      const res = await fetch(`${this.workerBaseUrl}/api/status?userId=${encodeURIComponent(this.userId)}`, {
        method: 'GET',
        headers: reqHeaders,
        signal: controller.signal,
      });

      if (!res.ok) return null;
      const data = (await res.json()) as PrayerStatusResult;
      return data;
    } catch {
      // Fail-open: network failure or timeout never blocks user chat
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Wraps an LLM call deterministically.
   * If prayer is due, appends the reminder text.
   */
  async processResponse(
    llmResponsePromise: Promise<string> | string,
    headers?: Record<string, string>
  ): Promise<{ responseText: string; reminderAppended: boolean; prayer?: string }> {
    // Run status check in parallel with LLM response resolution if promise
    const [llmText, status] = await Promise.all([
      Promise.resolve(llmResponsePromise),
      this.checkPrayerStatus(headers),
    ]);

    if (status && status.reminderDue && status.reminderText) {
      return {
        responseText: `${llmText}\n\n${status.reminderText}`,
        reminderAppended: true,
        prayer: status.prayer,
      };
    }

    return {
      responseText: llmText,
      reminderAppended: false,
    };
  }

  /**
   * Vercel AI SDK compatible stream/text transform
   */
  createTransform() {
    return async (responseText: string, clientHeaders?: Record<string, string>) => {
      const res = await this.processResponse(responseText, clientHeaders);
      return res.responseText;
    };
  }
}
