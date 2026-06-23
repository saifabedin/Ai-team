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
    // FML Health
    "coordinator:*",
    "appointment:*",
    "prep:*",
    "aftercare:*",
    "reputation:*",
    "referral:*",
    // ECM Agency
    "campaign:*",
    "social:*",
    "ad-ops:*",
    "reporting:*",
    "white-label:*",
    "calendar:*",
    "deliverables:*",
    "client-health:*",
  ],
  sales: ["lead-intel:read", "sdr:*", "voice:*", "proposal:*", "dashboard:read"],
  marketing: ["content:*", "lead-intel:read", "dashboard:read", "campaign:*", "social:*", "ad-ops:*", "calendar:*", "deliverables:*"],
  cs: ["success:*", "dashboard:read", "client-health:*", "reporting:*"],
  // Healthcare roles
  doctor: [
    "coordinator:read", "appointment:read", "appointment:write",
    "aftercare:read", "aftercare:write", "dashboard:read",
  ],
  receptionist: [
    "coordinator:*", "appointment:*", "prep:*",
    "reputation:read", "referral:read", "dashboard:read",
  ],
  // Agency roles
  "account-manager": [
    "campaign:*", "social:*", "reporting:*", "calendar:*",
    "deliverables:*", "client-health:*", "dashboard:read",
  ],
  "media-buyer": ["ad-ops:*", "campaign:read", "dashboard:read"],
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
