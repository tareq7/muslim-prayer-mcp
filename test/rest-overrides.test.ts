import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import type { KVNamespaceLike } from '../src/storage/kv-store.ts';

describe('REST calculation overrides', () => {
  for (const endpoint of ['status', 'timetable']) {
    it(`${endpoint} honors calculation authority and madhab overrides`, async () => {
      const response = await worker.fetch(new Request(`https://test.invalid/api/${endpoint}?city=Riyadh&calculationMethod=Karachi&madhab=Hanafi`), {});
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.calculationMethod, 'Karachi');
      assert.equal(body.madhab, 'Hanafi');
      assert.ok(body.authorityNotice);
    });
    it(`${endpoint} rejects invalid overrides`, async () => {
      for (const query of ['calculationMethod=invalid', 'madhab=invalid', 'madhab=']) {
        const response = await worker.fetch(new Request(`https://test.invalid/api/${endpoint}?city=Riyadh&${query}`), {});
        assert.equal(response.status, 400);
      }
    });
  }
});

it('returns a sanitized REST storage-unavailable error', async () => {
  const kv: KVNamespaceLike = {
    async get() { throw new Error('private-backend-secret'); },
    async put() { throw new Error('private-backend-secret'); },
    async delete() { throw new Error('private-backend-secret'); },
  };
  const response = await worker.fetch(new Request('https://test.invalid/api/status?city=Riyadh&userId=review-user'), { PRAYER_KV: kv });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: 'storage_unavailable', error: 'Prayer storage is unavailable' });
});
