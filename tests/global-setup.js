// Playwright globalSetup: wait for presenter /health to report ready
module.exports = async () => {
  const port = process.env.PORT || 8005;
  const host = process.env.HOST || '127.0.0.1';
  // Increase default timeout to 60s to accommodate slower CI environments
  const timeout = parseInt(process.env.HEALTH_TIMEOUT || '60000', 10);
  const interval = parseInt(process.env.HEALTH_INTERVAL || '500', 10);
  const deadline = Date.now() + timeout;

  const fetch = globalThis.fetch || (await import('node-fetch')).default;

  const fs = await import('fs');
  const path = await import('path');
  const runStartPath = path.resolve(__dirname, '..', 'NAVI', 'approvals', 'run_start.json');

  while (Date.now() < deadline) {
    try {
      // If a run_start.json exists, prefer using the port it reports (presenter wrote it)
      if (fs.existsSync && fs.existsSync(runStartPath)) {
        try {
          const data = fs.readFileSync(runStartPath, 'utf8');
          const obj = JSON.parse(data);
          if (obj && obj.port) {
            console.log('[global-setup] Found run_start.json, using presenter port', obj.port);
            process.env.PRESENTER_PORT = obj.port;
            // switch to that host/port for subsequent checks
          }
        } catch (e) { console.log('[global-setup] failed to read run_start.json', e && e.message); }
      }

      const targetPort = process.env.PRESENTER_PORT || port;
      const res = await fetch(`http://${host}:${targetPort}/health`);
      // Log status for debugging
      console.log(`[global-setup] health HTTP status: ${res.status} (port ${targetPort})`);
      if (res.ok) {
        const j = await res.json();
        console.log('[global-setup] health payload:', j);

        // Must be presenter: require presenter signature
        if (j && j.server && j.server.bound && j.servedFrom) {
          console.log('[global-setup] Presenter-style health verified', j.server);
          process.env.PRESENTER_PORT = j.server.port || targetPort;
          return;
        }

        // If we see NAVI-style health but no presenter signature, check for presenter assets
        if (j && (j.status === 'ok' || j.ok === true) && !(j.server && j.server.bound)) {
          console.log('[global-setup] NAVI-style health detected but no presenter signature; probing presenter assets');
          try {
            const assetsRes = await fetch(`http://${host}:${targetPort}/presenter/mail-room.html`);
            console.log(`[global-setup] assets probe status: ${assetsRes.status}`);
            if (assetsRes.ok) {
              console.log('[global-setup] Presenter assets present; accepting presenter');
              process.env.PRESENTER_PORT = targetPort;
              return;
            }
          } catch (e) {
            console.log('[global-setup] presenter assets probe failed:', e && e.message);
          }
          console.log('[global-setup] presenter not found at this port; waiting');
        }
      }
    } catch (e) {
      console.log('[global-setup] health check error (server may still be starting):', e && e.message);
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`Timed out waiting for presenter at http://${host}:${port}/health`);
};