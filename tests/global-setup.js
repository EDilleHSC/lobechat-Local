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
  let lastErrorMessage = null;

  while (Date.now() < deadline) {
    try {
      // If a run_start.json exists, prefer using the port it reports (presenter wrote it)
      if (fs.existsSync && fs.existsSync(runStartPath)) {
        try {
          const data = await fs.promises.readFile(runStartPath, 'utf8');
          const obj = JSON.parse(data);
          const portNum = Number(obj && obj.port);
          if (Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535) {
            console.log('[global-setup] Found run_start.json, using presenter port', portNum);
            process.env.PRESENTER_PORT = String(portNum);
            // If the run_start.json includes an address, honor it for the host
            if (obj.address) {
              console.log('[global-setup] run_start.json provided address, using host', obj.address);
              process.env.PRESENTER_HOST = obj.address;
            }
          } else {
            console.log('[global-setup] run_start.json port invalid or missing; ignoring');
          }
        } catch (e) {
          console.log('[global-setup] failed to read/parse run_start.json', e && e.message);
        }
      }

      const targetHost = process.env.PRESENTER_HOST || host;
      const targetPort = process.env.PRESENTER_PORT || port;
      const res = await fetch(`http://${targetHost}:${targetPort}/health`);
      // Log status for debugging
      console.log(`[global-setup] health HTTP status: ${res.status} (host ${targetHost} port ${targetPort})`);
      if (res.ok) {
        const j = await res.json();
        console.log('[global-setup] health payload:', j);

        // Must be presenter: require presenter signature
        if (j && j.server && j.server.bound && j.servedFrom) {
          console.log('[global-setup] Presenter-style health verified', j.server);
          process.env.PRESENTER_PORT = j.server.port || targetPort;
          if (j.server && j.server.address) process.env.PRESENTER_HOST = j.server.address;
          return;
        }

        // NAVI-style health detected but no presenter signature; do not accept as presenter.
        if (j && (j.status === 'ok' || j.ok === true) && !(j.server && j.server.bound)) {
          console.log('[global-setup] NAVI-style health detected but no presenter signature; continuing to wait for presenter-style health');
        }
      }
    } catch (e) {
      lastErrorMessage = e && e.message;
      console.log('[global-setup] health check error (server may still be starting):', lastErrorMessage);
    }
    await new Promise(r => setTimeout(r, interval));
  }
  const finalHost = process.env.PRESENTER_HOST || host;
  const finalPort = process.env.PRESENTER_PORT || port;
  throw new Error(`Timed out waiting for presenter at http://${finalHost}:${finalPort}/health (last error: ${lastErrorMessage || 'none'})`);
};