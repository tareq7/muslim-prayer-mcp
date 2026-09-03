import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPrayerMcpServer } from './mcp/server.ts';
import { MemoryKV, PrayerStorage } from './storage/kv-store.ts';

const storage = new PrayerStorage(new MemoryKV());
const server = createPrayerMcpServer(storage);
const transport = new StdioServerTransport();

await server.connect(transport);
