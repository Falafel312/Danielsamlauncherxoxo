function parseUpdateProvider(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid HTTPS update server URL.');
  const text = value.trim();
  if (!text) return null;
  let url; try { url = new URL(text); } catch { throw new Error('Enter a valid HTTPS update server URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.hostname.endsWith('.invalid') || ['localhost','127.0.0.1','0.0.0.0','[::1]'].includes(url.hostname)) throw new Error('Use a public HTTPS release URL without credentials, query parameters, or fragments.');
  if (url.hostname === 'github.com') {
    const match = url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/releases(?:\/latest)?)?\/?$/);
    if (!match) throw new Error('Use the GitHub repository URL, such as https://github.com/owner/repository.');
    return { provider: 'github', owner: match[1], repo: match[2], releaseType: 'release' };
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  return { provider: 'generic', url: url.href };
}
function createUpdateService({ version, supported, emit, isInGame, Updater }) {
  let updater, providerKey, checking, settings = { updateUrl:'', autoDownloadUpdates:true };
  let status = { version, status:'unconfigured', availableVersion:null, progress:0, lastCheck:null, message:'Add your release server in Settings to enable automatic updates.' };
  const update = patch => { status = { ...status, ...patch }; emit(status); };
  function configure(next) {
    const provider = parseUpdateProvider(next.updateUrl || '');
    const nextKey = JSON.stringify(provider);
    if (status.status === 'downloading' && nextKey !== providerKey) throw new Error('Wait for the current update download to finish before changing servers.');
    settings = { updateUrl:next.updateUrl || '', autoDownloadUpdates:next.autoDownloadUpdates !== false };
    if (!provider) { updater=null;providerKey=null;update({status:'unconfigured',availableVersion:null,progress:0,message:'Add your release server in Settings to enable automatic updates.'});return; }
    if (!supported) { update({status:'unsupported',message:'Use the installed version to download app updates. The portable launcher and development preview do not replace themselves.'});return; }
    if (!updater || nextKey !== providerKey) {
      const Constructor = Updater || require('electron-updater').NsisUpdater;
      updater = new Constructor(provider);
      providerKey = nextKey;
      updater.logger = null;
      updater.allowDowngrade = false;
      updater.allowPrerelease = false;
      updater.autoInstallOnAppQuit = false;
      updater.on('checking-for-update',()=>update({status:'checking',message:'Checking for a newer release…'}));
      updater.on('update-not-available',()=>update({status:'current',availableVersion:null,progress:0,lastCheck:new Date().toISOString(),message:'You have the latest available version.'}));
      updater.on('update-available',info=>update({status:settings.autoDownloadUpdates?'downloading':'available',availableVersion:info.version,progress:0,message:settings.autoDownloadUpdates?'Downloading the new version in the background…':'A newer version is available. Enable automatic downloads to get it.'}));
      updater.on('download-progress',progress=>update({status:'downloading',progress:Math.round(progress.percent),message:'Downloading the new version in the background…'}));
      updater.on('update-downloaded',info=>update({status:'ready',availableVersion:info.version,progress:100,lastCheck:new Date().toISOString(),message:'Update downloaded and verified. Restart to install when you are ready.'}));
      updater.on('error',()=>update({status:'error',message:'Could not retrieve the update. Check the release URL and internet connection, then try again.'}));
      update({status:'idle',availableVersion:null,progress:0,message:'Automatic update downloads are ready.'});
    }
    updater.autoDownload = settings.autoDownloadUpdates;
  }
  async function check() {
    if (!updater) return { ok:false,message:status.message };
    if (checking) return checking;
    if (['downloading','ready'].includes(status.status)) return {ok:true,message:status.message};
    checking = (async()=> {
      try {const result=await updater.checkForUpdates();if(!result)return {ok:false,message:'The updater is unavailable in this app build.'};update({lastCheck:new Date().toISOString()});if(result.downloadPromise) await result.downloadPromise;return {ok:true,message:status.message};}
      catch {update({status:'error',message:'Could not retrieve the update. Check the release URL and internet connection, then try again.'});return {ok:false,message:status.message};}
      finally {checking=null;}
    })();
    return checking;
  }
  function install() {
    if (isInGame()) return {ok:false,message:'Finish your League game before restarting to install the update.'};
    if (!updater || status.status!=='ready') return {ok:false,message:'No downloaded update is ready to install.'};
    updater.quitAndInstall(true,true);
    return {ok:true,message:'Restarting to install the downloaded update…'};
  }
  return {configure,check,install,getStatus:()=>status};
}
module.exports={parseUpdateProvider,createUpdateService};
