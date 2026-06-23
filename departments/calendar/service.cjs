"use strict";
const db = require("../../core/db.cjs");

async function getCalendar(brandId, { startDate, endDate, clientId, platform }) {
  let q = `select sp.*, cl.name as client_name from ait_social_posts sp left join ait_clients cl on cl.id=sp.client_id where sp.brand_id=$1`;
  const p = [brandId]; let i = 2;
  if (startDate) { q += ` and sp.scheduled_at >= $${i++}`; p.push(startDate); }
  if (endDate) { q += ` and sp.scheduled_at <= $${i++}`; p.push(endDate); }
  if (clientId) { q += ` and sp.client_id=$${i++}`; p.push(clientId); }
  if (platform) { q += ` and sp.platform=$${i++}`; p.push(platform); }
  q += ` order by sp.scheduled_at asc`;
  return db.many(q, p);
}

async function getWeekView(brandId, date) {
  const d = new Date(date);
  const start = new Date(d); start.setDate(d.getDate() - d.getDay());
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return getCalendar(brandId, { startDate: start.toISOString(), endDate: end.toISOString() });
}

async function getMonthView(brandId, year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return getCalendar(brandId, { startDate: start.toISOString(), endDate: end.toISOString() });
}

module.exports = { getCalendar, getWeekView, getMonthView };
