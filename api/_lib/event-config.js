import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve(process.env.EVENT_CONFIG_PATH || 'content/event.json');
const eventConfig = JSON.parse(readFileSync(configPath, 'utf8'));

if (!Array.isArray(eventConfig.menus) || !eventConfig.timezone) {
  throw new Error('Invalid event configuration');
}

export default eventConfig;
