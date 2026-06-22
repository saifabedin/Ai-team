"use strict";
// Role-based permissions. Roles map to allowed actions (department:verb).
const ROLES = {
  owner: ["*"],
  admin: [
    "lead-intel:*",
    "sdr:*",
    "voice:*",
    "proposal:*",
    "content:*",
    "success:*",
    "dashboard:read",
    "audit:read",
  ],
  sales: ["lead-intel:read", "sdr:*", "voice:*", "proposal:*", "dashboard:read"],
  marketing: ["content:*", "lead-intel:read", "dashboard:read"],
  cs: ["success:*", "dashboard:read"],
  viewer: ["dashboard:read", "lead-intel:read"],
};

function can(role, action) {
  const perms = ROLES[role];
  if (!perms) return false;
  if (perms.includes("*")) return true;
  if (perms.includes(action)) return true;
  const [dept] = action.split(":");
  return perms.includes(`${dept}:*`);
}

// Express middleware factory: requires req.user.role to satisfy `action`.
function require_(action) {
  return (req, res, next) => {
    const role = req.user?.role || "viewer";
    if (can(role, action)) return next();
    return res.status(403).json({ error: "forbidden", needed: action, role });
  };
}

module.exports = { ROLES, can, require: require_ };
