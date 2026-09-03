import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrayerReminderMiddleware } from '../src/middleware/host-connector.ts';
import worker from '../src/index.ts';

describe('End-to-End Simulation & Deterministic Middleware Suite', () => {
  // Mock LLM generation function simulating an unrelated user query
  async function simulateLlmTurn(prompt: string): Promise<string> {
    if (prompt.toLowerCase().includes('database')) {
      return 'PostgreSQL is the recommended relational database for this project due to robust ACID guarantees and JSONB support.';
    }
    return 'Default answer to user query.';
  }

  it('Case 1: Ordinary unrelated prompt + prayer currently due -> normal answer + prayer reminder', async () => {
    // Intercept fetch in middleware test environment to route directly to our Worker
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      if (url.pathname === '/api/status') {
        // Return a mock response indicating Maghrib is due
        return new Response(
          JSON.stringify({
            reminderDue: true,
            prayer: 'Maghrib',
            localDate: '2026-09-03',
            reminderText: '🕌 It is time for Maghrib prayer.',
            nextPrayer: 'Isha',
            nextPrayerAtUtc: '2026-09-03T16:40:00.000Z',
            timezone: 'Asia/Riyadh',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    };

    try {
      const middleware = new PrayerReminderMiddleware({
        workerBaseUrl: 'http://localhost',
        userId: 'user_e2e_1',
      });

      const userPrompt = 'What is the best database for this project?';
      const rawLlmAnswer = await simulateLlmTurn(userPrompt);

      const result = await middleware.processResponse(rawLlmAnswer);

      assert.equal(result.reminderAppended, true);
      assert.equal(result.prayer, 'Maghrib');
      assert.equal(
        result.responseText,
        'PostgreSQL is the recommended relational database for this project due to robust ACID guarantees and JSONB support.\n\n🕌 It is time for Maghrib prayer.'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Case 2: Ordinary unrelated prompt + no prayer due -> normal answer ONLY', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      if (url.pathname === '/api/status') {
        return new Response(
          JSON.stringify({
            reminderDue: false,
            localDate: '2026-09-03',
            nextPrayer: 'Dhuhr',
            nextPrayerAtUtc: '2026-09-03T08:53:00.000Z',
            timezone: 'Asia/Riyadh',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    };

    try {
      const middleware = new PrayerReminderMiddleware({
        workerBaseUrl: 'http://localhost',
        userId: 'user_e2e_2',
      });

      const userPrompt = 'What is the best database for this project?';
      const rawLlmAnswer = await simulateLlmTurn(userPrompt);

      const result = await middleware.processResponse(rawLlmAnswer);

      assert.equal(result.reminderAppended, false);
      assert.equal(result.prayer, undefined);
      assert.equal(
        result.responseText,
        'PostgreSQL is the recommended relational database for this project due to robust ACID guarantees and JSONB support.'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Case 3: Fail-Open resilience: Worker timeout or 500 does NOT fail user chat response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Simulated network timeout');
    };

    try {
      const middleware = new PrayerReminderMiddleware({
        workerBaseUrl: 'http://localhost',
        userId: 'user_e2e_3',
        timeoutMs: 50,
      });

      const userPrompt = 'What is the best database for this project?';
      const rawLlmAnswer = await simulateLlmTurn(userPrompt);

      const result = await middleware.processResponse(rawLlmAnswer);

      // Successfully falls back to untouched response without throwing
      assert.equal(result.reminderAppended, false);
      assert.equal(
        result.responseText,
        'PostgreSQL is the recommended relational database for this project due to robust ACID guarantees and JSONB support.'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Case 4: Live Worker integration with simulated headers', async () => {
    const originalFetch = globalThis.fetch;
    // Route directly to real worker.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      return worker.fetch(req, {});
    };

    try {
      const middleware = new PrayerReminderMiddleware({
        workerBaseUrl: 'http://localhost',
        userId: 'user_live_test',
      });

      const rawLlmAnswer = await simulateLlmTurn('What is the best database for this project?');
      const result = await middleware.processResponse(rawLlmAnswer, {
        'X-User-Coordinates': '24.71, 46.68',
        'X-User-Timezone': 'Asia/Riyadh',
      });

      // Response must always be string and contain LLM answer
      assert.ok(result.responseText.startsWith('PostgreSQL is the recommended'));
      if (result.reminderAppended) {
        assert.ok(result.responseText.includes('🕌'));
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
