const REMINDERS = Object.freeze({ enabled: true, healthEnabled: true, healthThreshold: 25, manaEnabled: true, manaThreshold: 20, dragonEnabled: true, dragonLead: 30, dragonMode: 'standard', duration: 5, cooldown: 45, repeatLow: false, x: 50, y: 40, scale: 1 });
const SCOREBOARD = Object.freeze({ enabled: true, x: 79, y: 32, scale: 1, rowHeight: 48 });
function sanitizeGroup(input, previous, defaults, ranges, enums = {}) {
  const result = { ...defaults, ...previous };
  for (const [key, value] of Object.entries(input || {})) {
    if (typeof defaults[key] === 'boolean' && typeof value === 'boolean') result[key] = value;
    if (ranges[key] && typeof value === 'number' && Number.isFinite(value)) result[key] = Math.max(ranges[key][0], Math.min(ranges[key][1], value));
    if (enums[key]?.includes(value)) result[key] = value;
  }
  return result;
}
const sanitizeReminders = (input, previous) => sanitizeGroup(input, previous, REMINDERS, { healthThreshold: [5, 80], manaThreshold: [5, 80], dragonLead: [5, 120], duration: [2, 15], cooldown: [10, 300], x: [5, 95], y: [5, 90], scale: [.6, 1.4] }, { dragonMode: ['standard', 'swiftplay'] });
const sanitizeScoreboard = (input, previous) => sanitizeGroup(input, previous, SCOREBOARD, { x: [5, 95], y: [5, 80], scale: [.6, 1.4], rowHeight: [30, 80] });
module.exports = { REMINDERS, SCOREBOARD, sanitizeReminders, sanitizeScoreboard };
