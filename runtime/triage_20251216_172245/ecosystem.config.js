module.exports = {
  apps: [
    {
      name: 'mcp-navi',
      script: 'D:/05_AGENTS-AI/01_RUNTIME/VBoarder/runtime/triage_20251216_172245/mcp_server.js',

      // Restart behavior
      autorestart: true,
      restart_delay: 2000,
      kill_timeout: 3000,

      // Safety / clarity
      watch: false,
      max_restarts: 5,
      env: {
        NODE_ENV: 'production',
        MCP_APPROVAL_TOKEN: 'TRUSTED_APPROVAL_2024'
      }
    }
  ]
};
