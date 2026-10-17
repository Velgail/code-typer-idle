// The game checks successive project changes, independently of public releases.
export const BUILD_STATUSES=['passed','warnings','test-failed','compile-failed'];
export const BUILD_TRIGGERS=['automatic','manual','review','release','library','repair','assets'];
export const createBuildState=()=>({revision:0,checkedRevision:0,changed:0,checkedProgress:0,knownDefects:0,count:0,last:null,history:[]});
export const buildStepFor=target=>Math.max(100,Math.min(4000,Math.round(Math.sqrt(target)*.4)*10));
export const needsBuild=s=>s.build.revision!==s.build.checkedRevision || !s.build.last && (s.progress>0 || s.debt>0 || s.defects>0);
export function markBuildChanges(s,amount){
  if(!(amount>0))return;
  if(s.build.revision>=Number.MAX_SAFE_INTEGER){s.build.revision=1;s.build.checkedRevision=0;}
  else s.build.revision++;
  s.build.changed=Math.min(1e250,s.build.changed+amount);
}
export function normalizeBuildState(raw,s,target){
  const b=createBuildState();if(!raw || typeof raw!=='object')return b;
  const num=(x,fallback=0,max=1e250)=>typeof x==='number' && Number.isFinite(x) && x>=0 && x<=max?x:fallback;
  b.revision=Math.floor(num(raw.revision,0,Number.MAX_SAFE_INTEGER));
  b.checkedRevision=Math.floor(num(raw.checkedRevision,0,b.revision));
  b.changed=num(raw.changed);b.checkedProgress=num(raw.checkedProgress,0,s.progress);
  b.knownDefects=num(raw.knownDefects,0,s.defects);b.count=Math.floor(num(raw.count));
  const record=x=>x && BUILD_STATUSES.includes(x.status) && BUILD_TRIGGERS.includes(x.trigger)?{
    status:x.status,trigger:x.trigger,revision:Math.floor(num(x.revision,0,b.revision)),
    progress:num(x.progress,0,target),defects:num(x.defects),time:num(x.time,0,s.stats.time),checks:Math.max(1,Math.floor(num(x.checks,1)))
  }:null;
  b.last=record(raw.last);b.history=Array.isArray(raw.history)?raw.history.slice(-6).map(record).filter(Boolean):[];
  if(!b.last){b.checkedRevision=0;b.knownDefects=0;}
  else{
    b.checkedRevision=b.last.revision;
    b.checkedProgress=Math.min(s.progress,b.last.progress);
    b.knownDefects=Math.min(b.knownDefects,b.last.defects);
  }
  return b;
}
