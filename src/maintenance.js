// Deferred work is distinct from defects: debt can exist in a working release.
export const DEVELOPMENT_POLICIES = [
  { id:'steady', name:'動く形を積み上げる', speed:1, temporary:.02, coupling:.03, verification:.01, defects:.006, description:'実装を進めながら、構造と仕様を少しずつ固める。' },
  { id:'structured', name:'構造を整えて進める', speed:.95, temporary:.003, coupling:.008, verification:.004, defects:.002, description:'先に責務を分け、仕様を確認する。手は遅くなるが、後で変更しやすい。' },
  { id:'prototype', name:'仮実装で先へ進む', speed:1.35, temporary:.06, coupling:.10, verification:.02, defects:.035, description:'まず動かす。小さな試作は速いが、継ぎ足すほど構造が絡み合う。' }
];
export const DEBT_CAUSES = [
  {id:'temporary',name:'仮実装・重複処理',description:'ひとまず動かした分岐や、コピーして増やした処理。'},
  {id:'coupling',name:'継ぎ足した構造',description:'既存の処理へ接ぎ足し、変更の影響を追いにくくなった部分。'},
  {id:'verification',name:'確認を先送りした仕様',description:'想定した仕様と実際の動作を、まだ照合していない部分。'},
  {id:'reuse',name:'流用コードの未整理部分',description:'既存の共通コードとともに引き継いだ整理作業。'}
];
export const emptyDebtSources=()=>Object.fromEntries(DEBT_CAUSES.map(c=>[c.id,0]));
export const developmentPolicy=s=>DEVELOPMENT_POLICIES.find(p=>p.id===s.developmentPolicy) || DEVELOPMENT_POLICIES[0];
// Early experience leaves more accidental coupling, even when the program works.
// Knowledge and completed projects improve this habit without making it perfect.
export const unnoticedDebtMultiplier=s=>.4+.6/(1+Math.sqrt(s.skills.design/40)+s.stats.releases*.15);
export const changeDefectRate=(s,limit)=>developmentPolicy(s).defects+.06*Math.min(2,s.debt/limit)**1.3;
export function debtBreakdown(s){
  const entries=DEBT_CAUSES.map(c=>({...c,amount:Math.max(0,Math.min(s.debt,s.debtSources?.[c.id] || 0))}));
  const total=entries.reduce((sum,c)=>sum+c.amount,0);
  if(total>s.debt && total)for(const c of entries)c.amount*=s.debt/total;
  if(total<s.debt){
    const gap=s.debt-total;
    const target=total && gap<=Math.max(1,s.debt)*1e-12?entries.find(c=>c.amount>0):entries.find(c=>c.id==='reuse');
    target.amount+=gap;
  }
  return entries.filter(c=>c.amount>0);
}
export function debtAgeDays(s,day){return s.debt>0?Math.max(0,s.stats.time-s.reviewedAt)/day:0;}
export function maintenanceEfficiency(s,limit,day){
  const age=Math.min(1,debtAgeDays(s,day)/30);
  return Math.max(.1,1-s.debt/limit*.6*(1+age*.5));
}
export function incurredDebt(s,amount,target){
  const p=developmentPolicy(s),complexity=Math.min(2,1+Math.max(0,Math.log10(target/3000))*.2),growth=(.5+.5*Math.min(1,s.progress/target))*complexity;
  const work=amount*unnoticedDebtMultiplier(s);
  const couplingGrowth=p.id==='prototype'?growth**2:growth;
  return {temporary:work*p.temporary,coupling:work*p.coupling*couplingGrowth*(1+s.debt/(target*.25)),verification:work*p.verification,reuse:0};
}
export function addDebt(s,sources,limit){
  const before=debtBreakdown(s),room=Math.max(0,limit-s.debt),total=Object.values(sources).reduce((a,b)=>a+b,0),scale=total?Math.min(1,room/total):0;
  s.debtSources=emptyDebtSources();for(const c of before)s.debtSources[c.id]=c.amount;
  for(const {id} of DEBT_CAUSES)s.debtSources[id]+=(sources[id] || 0)*scale;
  s.debt=Math.min(limit,Object.values(s.debtSources).reduce((a,b)=>a+b,0));
  return total*scale;
}
export function repayDebt(s,amount){
  const before=s.debt,paid=Math.min(before,amount),fraction=before?(before-paid)/before:0,sources=debtBreakdown(s);
  s.debt=Math.max(0,before-paid);s.debtSources=emptyDebtSources();
  for(const c of sources)s.debtSources[c.id]=c.amount*fraction;
  return paid;
}
