// PM2 process map for the FixMyLeads AI Team. Run: pm2 start ecosystem.config.js
// After .env changes always use: pm2 reload all --update-env
module.exports = {
  apps: [
    {
      name: "ai-team-gateway",
      script: "gateway/server.cjs",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      restart_delay: 3000,
      error_file: "logs/gateway-error.log",
      out_file: "logs/gateway-out.log",
      merge_logs: true,
    },
    {
      name: "ai-team-worker",
      script: "workers/index.cjs",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      restart_delay: 3000,
      error_file: "logs/worker-error.log",
      out_file: "logs/worker-out.log",
      merge_logs: true,
    },
    {
      name: "ai-team-dashboard",
      script: "dashboard/server.cjs",
      env: { NODE_ENV: "production" },
      max_memory_restart: "200M",
      restart_delay: 3000,
      error_file: "logs/dashboard-error.log",
      out_file: "logs/dashboard-out.log",
      merge_logs: true,
    },
    {
      name: "ai-team-control",
      script: "control/bot.cjs",
      env: { NODE_ENV: "production" },
      max_memory_restart: "200M",
      restart_delay: 5000,
      error_file: "logs/control-error.log",
      out_file: "logs/control-out.log",
      merge_logs: true,
    },
    {
      name: "ai-team-autopilot",
      script: "core/autopilot.cjs",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
      restart_delay: 10000,   // give Redis/DB time to come up before autopilot retries
      error_file: "logs/autopilot-error.log",
      out_file: "logs/autopilot-out.log",
      merge_logs: true,
    },
  ],
};
