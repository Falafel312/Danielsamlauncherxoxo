const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {parseUpdateProvider,createUpdateService} = require('../electron/updates.cjs');
test('update feeds require HTTPS, reject embedded credentials, and support GitHub repositories',()=> {
  assert.deepEqual(parseUpdateProvider('https://example.com/updates'),{provider:'generic',url:'https://example.com/updates/'});
  assert.deepEqual(parseUpdateProvider('https://github.com/example/launcher/releases/latest'),{provider:'github',owner:'example',repo:'launcher',releaseType:'release'});
  assert.equal(parseUpdateProvider(''),null);
  for(const url of ['http://example.com','https://user:pass@example.com','file:///tmp/update','https://localhost/','https://updates.invalid/','https://example.com/?secret=1','https://github.com/example'])assert.throws(()=>parseUpdateProvider(url));
});
class FakeUpdater extends EventEmitter {
  constructor(provider){super();this.provider=provider;this.installs=[];FakeUpdater.last=this;}
  async checkForUpdates(){this.emit('checking-for-update');this.emit('update-available',{version:'0.2.0'});const downloadPromise=this.autoDownload?Promise.resolve().then(()=>{this.emit('download-progress',{percent:50});this.emit('update-downloaded',{version:'0.2.0'});}):null;return {downloadPromise};}
  quitAndInstall(...args){this.installs.push(args);}
}
test('new releases download automatically and become ready without forcing a restart',async()=>{
  const changes=[];let playing=true;
  const service=createUpdateService({version:'0.1.0',supported:true,emit:s=>changes.push(s),isInGame:()=>playing,Updater:FakeUpdater});
  service.configure({updateUrl:'https://example.com/releases/',autoDownloadUpdates:true});
  assert.equal(FakeUpdater.last.autoDownload,true);assert.equal(FakeUpdater.last.autoInstallOnAppQuit,false);assert.equal(FakeUpdater.last.allowDowngrade,false);
  assert.equal((await service.check()).ok,true);assert.equal(service.getStatus().status,'ready');assert.equal(service.getStatus().progress,100);
  assert.ok(changes.some(s=>s.status==='downloading'&&s.progress===50));assert.equal(FakeUpdater.last.installs.length,0);
  assert.equal(service.install().ok,false);playing=false;assert.equal(service.install().ok,true);assert.deepEqual(FakeUpdater.last.installs,[[true,true]]);
});
test('opting out of automatic downloads leaves the update available without downloading',async()=>{
  const service=createUpdateService({version:'0.1.0',supported:true,emit:()=>{},isInGame:()=>false,Updater:FakeUpdater});
  service.configure({updateUrl:'https://example.com/releases/',autoDownloadUpdates:false});await service.check();assert.equal(service.getStatus().status,'available');assert.equal(service.getStatus().progress,0);assert.equal(service.install().ok,false);
});
test('unconfigured and portable builds make no update network calls',async()=>{
  class ForbiddenUpdater{constructor(){throw new Error('Should not initialize');}}
  const service=createUpdateService({version:'0.1.0',supported:false,emit:()=>{},isInGame:()=>false,Updater:ForbiddenUpdater});
  service.configure({updateUrl:'',autoDownloadUpdates:true});assert.equal(service.getStatus().status,'unconfigured');assert.equal((await service.check()).ok,false);
  service.configure({updateUrl:'https://example.com/releases/',autoDownloadUpdates:true});assert.equal(service.getStatus().status,'unsupported');assert.equal((await service.check()).ok,false);
});
test('update errors are recoverable and do not expose server response details',async()=>{
  class BrokenUpdater extends FakeUpdater{async checkForUpdates(){throw new Error('private server payload');}}
  const service=createUpdateService({version:'0.1.0',supported:true,emit:()=>{},isInGame:()=>false,Updater:BrokenUpdater});service.configure({updateUrl:'https://example.com/',autoDownloadUpdates:true});
  assert.equal((await service.check()).ok,false);assert.equal(service.getStatus().status,'error');assert.equal(service.getStatus().message.includes('private'),false);
});
