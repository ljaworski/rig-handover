import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { isNight } from './digest/night.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage, NoDigest } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const id = c.req.param('night');
    const night = isNight(id) ? readNight(config.runsDir, id) : null;
    if (!night) {
      return c.html(
        <Layout title={`digest · ${id}`} lane={lane()}>
          <NoDigest night={id} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${id}`} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = isNight(night) ? readNight(config.runsDir, night) : null;
    return data ? c.json(data) : c.json({ error: `no run log for ${night}` }, 404);
  });

  return app;
}
