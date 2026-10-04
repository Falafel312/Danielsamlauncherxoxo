// Official platform routing, shared by the desktop and the API backend.
const PLATFORMS = Object.freeze({ na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas', euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe', me1: 'europe', kr: 'asia', jp1: 'asia', oc1: 'sea', sg2: 'sea', tw2: 'sea', vn2: 'sea' });
const DEFAULT_ACCOUNT = Object.freeze({ serverUrl: 'http://127.0.0.1:4317', riotId: '', platform: 'euw1' });

function parseRiotId(value) {
  if (typeof value !== 'string' || value.length > 100 || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Enter your Riot ID as Name#TAG.');
  const parts = value.trim().split('#');
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim() || parts[0].length > 64 || parts[1].length > 16) throw new Error('Enter your Riot ID as Name#TAG.');
  return { gameName: parts[0].trim(), tagLine: parts[1].trim() };
}
function validatePlatform(value) {
  const platform = typeof value === 'string' ? value.toLowerCase() : '';
  if (!Object.hasOwn(PLATFORMS, platform)) throw new Error('Choose a supported League server.');
  return platform;
}
function validateAccount(input, allowEmpty = false) {
  let url;
  try { url = new URL(input?.serverUrl); } catch { throw new Error('Enter your Riot backend URL.'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash || url.href.length > 512) throw new Error('Use HTTPS for your backend, or HTTP on localhost. Do not include credentials or query parameters.');
  const platform = validatePlatform(input.platform);
  const id = allowEmpty && !input.riotId ? null : parseRiotId(input.riotId);
  return { serverUrl: url.href.replace(/\/+$/, ''), riotId: id ? `${id.gameName}#${id.tagLine}` : '', platform };
}
module.exports = { PLATFORMS, DEFAULT_ACCOUNT, parseRiotId, validatePlatform, validateAccount };
