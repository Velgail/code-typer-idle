// Reproduce app-logic anchors: node scripts/calibration-app-fixtures.mjs
// Reference implementations are deliberately outside the solver's publicSpec.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { typingKeystrokes } from '../src/typing.js';
import { normalizeBuildState, BUILD_STATUSES, BUILD_TRIGGERS } from '../src/builds.js';
import { remainingSales, titleSalesRate, salesDuring, settleSales, experienceReward, experienceCap, experienceRequirements } from '../src/career.js';
import { createOCRLedger, recordOCR, correctOCR } from '../src/officequality.js';
import { debtBreakdown, repayDebt } from '../src/maintenance.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const execute = promisify(execFile);
const clone = x => structuredClone(x);
const milli = x => Math.floor(x * 1000 + .5);
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const parameter = (name,cppType) => ({ name, cppType, type: cppType === 'int' ? 'integer' : cppType === 'std::string' ? 'string' : 'integer-array' });
const metrics = source => ({ bytes:Buffer.byteLength(source), characters:source.length, physicalLines:source.trimEnd().split('\n').length, nonblankLines:source.split('\n').filter(x=>x.trim()).length, asciiCharacters:[...source].filter(c=>c.charCodeAt(0)<128).length, nonAsciiCharacters:[...source].filter(c=>c.charCodeAt(0)>=128).length, physicalTypingKeys:typingKeystrokes(source), sha256:sha(source) });
function evidence(file, markers) {
  const text=fs.readFileSync(path.join(root,file),'utf8');
  const spans=markers.map(marker=>{
    const start=text.indexOf(marker);
    if(start<0)throw Error(`Missing marker ${marker}`);
    let end;
    if(marker.includes('function ')) {
      let depth=0; const brace=start+text.slice(start).search(/\)\s*\{/)+text.slice(start).match(/\)\s*\{/)[0].length-1;
      // These selected functions have no unmatched braces in string literals.
      for(end=brace;end<text.length;end++){if(text[end]==='{')depth++;if(text[end]==='}'&&!--depth) { end++;break; }}
    } else end=text.indexOf('\n',start);
    const source=text.slice(start,end);
    return { symbol:marker.replace(/^export /,'').replace(/function |const /,'').split(/[=(]/)[0].trim(), firstLine:text.slice(0,start).split('\n').length, lastLine:text.slice(0,end).split('\n').length, metrics:metrics(source) };
  });
  return { file, fileSha256:sha(text), spans, selectedLogicMetrics:{ physicalLines:spans.reduce((a,s)=>a+s.metrics.physicalLines,0), nonblankLines:spans.reduce((a,s)=>a+s.metrics.nonblankLines,0), physicalTypingKeys:spans.reduce((a,s)=>a+s.metrics.physicalTypingKeys,0) } };
}

function spec(id,title,entryPoint,parameters,returnType,statement,sourceEvidence,referenceSource) {
  const args=parameters.map(p=>`${p.cppType} ${p.name}`).join(', ');
  const starterSource=`${returnType} ${entryPoint}(${args}) {\n    // Implement the specified behavior.\n    return ${returnType==='int'?'0':'{}'};\n}\n`;
  return { id, kind:'application', publicSpec:{ language:'cpp', title, entryPoint, parameters, returnType, statement, starterSource, constraints:'Use C++17. The harness supplies <algorithm>, <cmath>, <string>, <vector>, <iostream>, <iomanip>. Return a value; do not add main or read stdin. All arrays have the documented shape. All specified arithmetic quantities fit signed 32-bit integers after output scaling.' }, sourceEvidence, referenceSource, fixtures:[] };
}

const keyReference=String.raw`int physical_keystrokes(std::string source) {
    int result = 0;
    for (std::size_t i = 0; i < source.size();) {
        if (source[i] != ' ') { ++result; ++i; continue; }
        std::size_t end = i;
        while (end < source.size() && source[end] == ' ') ++end;
        result += int((end - i + 3) / 4);
        i = end;
    }
    return result;
}
`;
function keyIndependent([source]) {
  return source.split(/( +)/).reduce((n,p)=>n+(p.startsWith(' ')?Math.ceil(p.length/4):p.length),0);
}
const keys=spec('app-physical-keystrokes','Indentation-aware typing effort','physical_keystrokes',[parameter('source','std::string')],'int',`Count physical typing keys in an ASCII source string. Each maximal run of ordinary spaces (ASCII 32) is entered using one key for each group of at most four spaces: a run of length n costs ceil(n/4). Every other ASCII character costs one key, including a tab, carriage return, and line feed. Runs do not cross other characters. The string may be empty and has at most 20,000 characters. Return the total cost.`,[evidence('src/typing.js',['export const typingKeystrokes'])],keyReference);

const experienceReference=String.raw`std::vector<int> career_requirements(int index) {
    const int table[7][3] = {{2,0,0},{3,2,1},{6,5,6},{14,16,18},{32,40,50},{80,100,140},{200,280,350}};
    std::vector<int> out;
    if (index < 7) out.insert(out.end(), table[index], table[index] + 3);
    else {
        int power = 1;
        for (int i = 0; i < index - 6; ++i) power *= 3;
        out.insert(out.end(), {200*power,280*power,350*power});
    }
    if (index < 2) out.insert(out.end(), {0,0,0,0});
    else if (index == 2) out.insert(out.end(), {1,60,40,60});
    else {
        int limit = 240;
        for (int i = 0; i < index - 3; ++i) limit *= 5;
        out.insert(out.end(), {1,limit,limit,limit});
    }
    if (index < 2) out.insert(out.end(), {0,0,0,0,0,0});
    else if (index == 2) out.insert(out.end(), {5,2,1,0,0,0});
    else if (index == 3) out.insert(out.end(), {25,18,20,1,1,0});
    else {
        int power = 1;
        for (int i = 0; i < index - 4; ++i) power *= 3;
        out.insert(out.end(), {160*power,120*power,100*power,index-1,index-1,index-3});
    }
    return out;
}
`;
function experienceActual([i]) {
  const r=experienceReward(i),cap=experienceCap(i),req=experienceRequirements(i);
  return [r.craft,r.design,r.audience,cap?1:0,cap?.craft||0,cap?.design||0,cap?.audience||0,req.experience.craft,req.experience.design,req.experience.audience,req.items.engineer||0,req.items.library||0,req.items.cluster||0];
}
function experienceIndependent([i]) {
  const reward=[[2,0,0],[3,2,1],[6,5,6],[14,16,18],[32,40,50],[80,100,140],[200,280,350]][i]||[200,280,350].map(x=>x*Math.pow(3,i-6));
  const cap=i<2?[0,0,0,0]:i===2?[1,60,40,60]:[1,...Array(3).fill(240*Math.pow(5,i-3))];
  const requirements=i<2?[0,0,0,0,0,0]:i===2?[5,2,1,0,0,0]:i===3?[25,18,20,1,1,0]:[160,120,100].map(x=>x*Math.pow(3,i-4)).concat(i-1,i-1,i-3);
  return [...reward,...cap,...requirements];
}
const experience=spec('app-career-requirements','Persistent experience and project access','career_requirements',[parameter('index','int')],'std::vector<int>',`A project has an index from 0 through 12. Compute its experience reward, its experience carry-over cap, and its access requirements. All triples are ordered [craft, design, audience].\nRewards for indices 0..6 are [2,0,0], [3,2,1], [6,5,6], [14,16,18], [32,40,50], [80,100,140], [200,280,350]. For i>=7 the reward is [200,280,350] multiplied by 3^(i-6).\nAt i<2 there is no carry-over cap. At i=2 the cap is [60,40,60]. At i>=3 all three caps equal 240*5^(i-3).\nAt i<2 no experience or equipment is required. At i=2 the required experience is [5,2,1], with no equipment. At i=3 it is [25,18,20], plus one engineer and one library. At i>=4 it is [160,120,100]*3^(i-4), plus i-1 engineers, i-1 libraries and i-3 clusters.\nReturn 13 integers: reward triple, cap-present flag (0/1), cap triple (all zero if absent), required-experience triple, required engineers, required libraries, required clusters.`,[evidence('src/career.js',['export function experienceReward','export function experienceCap','export function experienceRequirements'])],experienceReference);

const buildReference=String.raw`std::vector<int> restore_build(std::vector<int> state, std::vector<int> header, std::vector<int> last, std::vector<int> history) {
    const int progress = state[0], defects = state[1], time = state[2], target = state[3];
    auto valid = [](int value, int maximum) { return value >= 0 && value <= maximum ? value : 0; };
    if (header.empty()) return {0,0,0,0,0,0,0,0};
    std::vector<int> b = header;
    for (int &x : b) x = std::max(0,x);
    b[1] = valid(header[1],b[0]); b[3] = valid(header[3],progress); b[4] = valid(header[4],defects);
    auto normalize = [&](std::vector<int> r) {
        if (r.empty() || r[0] < 0 || r[0] > 3 || r[1] < 0 || r[1] > 6) return std::vector<int>{};
        r[2] = valid(r[2],b[0]); r[3] = valid(r[3],target); r[4] = std::max(0,r[4]);
        r[5] = valid(r[5],time); r[6] = std::max(1,r[6]);
        return r;
    };
    last = normalize(last);
    if (last.empty()) { b[1] = 0; b[4] = 0; }
    else { b[1] = last[2]; b[3] = std::min(progress,last[3]); b[4] = std::min(b[4],last[4]); }
    std::vector<int> records;
    for (int i = std::max(0,int(history.size())-42); i < int(history.size()); i += 7) {
        auto r = normalize(std::vector<int>(history.begin()+i,history.begin()+i+7));
        records.insert(records.end(),r.begin(),r.end());
    }
    b.push_back(last.empty()?0:1); b.insert(b.end(),last.begin(),last.end());
    b.push_back(int(records.size())/7); b.insert(b.end(),records.begin(),records.end());
    return b;
}
`;
const decodeRecord = r => r.length?{ status:BUILD_STATUSES[r[0]]??'invalid',trigger:BUILD_TRIGGERS[r[1]]??'invalid',revision:r[2],progress:r[3],defects:r[4],time:r[5],checks:r[6] }:null;
const encodeRecord = r => [BUILD_STATUSES.indexOf(r.status),BUILD_TRIGGERS.indexOf(r.trigger),r.revision,r.progress,r.defects,r.time,r.checks];
function buildActual([state,header,last,history]) {
  const raw=header.length?{ revision:header[0],checkedRevision:header[1],changed:header[2],checkedProgress:header[3],knownDefects:header[4],count:header[5],last:decodeRecord(last),history:Array.from({length:history.length/7},(_,i)=>decodeRecord(history.slice(i*7,i*7+7))) }:null;
  const b=normalizeBuildState(raw,{progress:state[0],defects:state[1],stats:{time:state[2]}},state[3]);
  return [b.revision,b.checkedRevision,b.changed,b.checkedProgress,b.knownDefects,b.count,b.last?1:0,...(b.last?encodeRecord(b.last):[]),b.history.length,...b.history.flatMap(encodeRecord)];
}
function buildIndependent([state,header,last,history]) {
  if(!header.length)return Array(8).fill(0);
  const check=(n,cap=2147483647)=>n>=0&&n<=cap?n:0;
  const h=[check(header[0]),check(header[1],check(header[0])),check(header[2]),check(header[3],state[0]),check(header[4],state[1]),check(header[5])];
  const process=r=>!r.length||r[0]<0||r[0]>=4||r[1]<0||r[1]>=7?null:[r[0],r[1],check(r[2],h[0]),check(r[3],state[3]),check(r[4]),check(r[5],state[2]),Math.max(1,r[6])];
  const kept=Array.from({length:history.length/7},(_,i)=>history.slice(i*7,i*7+7)).slice(-6).map(process).filter(Boolean);
  const latest=process(last);
  if(latest){h[1]=latest[2];h[3]=Math.min(state[0],latest[3]);h[4]=Math.min(h[4],latest[4]);}else{h[1]=0;h[4]=0;}
  return [...h,latest?1:0,...(latest||[]),kept.length,...kept.flat()];
}
const builds=spec('app-build-restore','Restore bounded build history','restore_build',[parameter('state','std::vector<int>'),parameter('header','std::vector<int>'),parameter('last','std::vector<int>'),parameter('history','std::vector<int>')],'std::vector<int>',`Normalize a saved build state. state=[currentProgress,currentDefects,currentTime,projectTarget], all nonnegative. header is empty (no saved object), or [revision,checkedRevision,changed,checkedProgress,knownDefects,count]. A record is [status,trigger,revision,progress,defects,time,checks]. last is empty or one record. history concatenates zero or more records. Status codes 0..3 and trigger codes 0..6 are valid; other codes invalidate the whole record.\nIf header is empty return eight zeros immediately. Otherwise replace negative header numbers with 0. Also replace checkedRevision>revision, checkedProgress>currentProgress, and knownDefects>currentDefects with 0.\nNormalize valid records: replace a negative numeric field with 0, except checks becomes at least 1. Replace revision>normalized header revision, progress>projectTarget, or time>currentTime with 0. Keep status and trigger unchanged. Select the last six raw history records BEFORE discarding invalid records; preserve their order.\nIf last is invalid or absent, set checkedRevision=knownDefects=0. Otherwise set checkedRevision=last.revision, checkedProgress=min(currentProgress,last.progress), and knownDefects=min(normalized header knownDefects,last.defects).\nReturn normalized header's six fields, last-present flag, the seven fields of last if present, history count, and concatenated normalized history records. Inputs are integers from -1000 through 1,000,000; history has at most 30 records. Empty-header output uses last-present=0 and history-count=0.`,[evidence('src/builds.js',['export const createBuildState','export function normalizeBuildState'])],buildReference);

const salesReference=String.raw`std::vector<int> settle_sales(std::vector<int> header, std::vector<int> batches, std::vector<int> steps) {
    std::vector<double> remaining;
    for (int i = 0; i < int(batches.size()); i += 4) remaining.push_back(std::max(0,batches[i+1]));
    double balance = std::max(0,header[5]), copies = header[2], earned = header[3];
    auto half = [](int x) { return double(x == 0 ? 3600 : std::max(1,x)); };
    auto rounded = [](double x) { return int(std::floor(x*1000+.5)); };
    std::vector<int> out;
    for (int seconds : steps) {
        double sold = 0, addedCopies = 0;
        if (header[7]) {
            for (int i = 0; i < int(remaining.size()); ++i) {
                const int at = i*4;
                if (!header[0] || !batches[at]) continue;
                double amount = remaining[i] * -std::expm1(-std::log(2.0)*std::max(0,seconds)/half(batches[at+2]));
                remaining[i] = std::max(0.0,remaining[i]-amount);
                sold += amount;
                if (batches[at+3]) addedCopies += amount/batches[at+3];
            }
            balance = 0; for (double x : remaining) balance += x;
        } else {
            if (header[0]) sold = balance * -std::expm1(-std::log(2.0)*std::max(0,seconds)/half(header[6]));
            balance = std::max(0.0,balance-sold);
            if (header[4]) addedCopies = sold/header[4];
        }
        copies = std::min(double(header[1]),copies+addedCopies); earned += sold;
        double royalty = 0;
        if (header[0]) {
            if (header[7]) {
                for (int i = 0; i < int(remaining.size()); ++i) if (batches[i*4]) royalty += remaining[i]*std::log(2.0)/half(batches[i*4+2]);
            } else royalty = balance*std::log(2.0)/half(header[6]);
        }
        out.insert(out.end(),{rounded(sold),rounded(balance),rounded(copies),rounded(earned),rounded(royalty)});
        for (double x : remaining) out.push_back(rounded(x));
    }
    return out;
}
`;
function salesActual([header,batches,steps]) {
  const title={active:!!header[0],totalCopies:header[1],soldCopies:header[2],salesEarned:header[3],unitPrice:header[4],salesRemaining:header[5],salesHalfLife:header[6]};
  if(header[7]) title.salesBatches=Array.from({length:batches.length/4},(_,i)=>({active:!!batches[i*4],remaining:batches[i*4+1],halfLife:batches[i*4+2],unitPrice:batches[i*4+3]}));
  return steps.flatMap(t=>{const sold=settleSales(title,t);return [sold,title.salesRemaining,title.soldCopies,title.salesEarned,title.royalty,...(title.salesBatches?.map(b=>b.remaining)||[])].map(milli);});
}
function salesIndependent([header,batches,steps]) {
  const rows=header[7]?Array.from({length:batches.length/4},(_,i)=>batches.slice(i*4,i*4+4)):[[1,header[5],header[6],header[4]]];
  let copies=header[2],earned=header[3]; const result=[];
  for(const step of steps){
    let sold=0,extra=0;
    for(const r of rows){
      if(!header[0]||!r[0])continue;
      const h=r[2]===0?3600:Math.max(1,r[2]),before=Math.max(0,r[1]),after=before*Math.pow(2,-Math.max(0,step)/h);
      const amount=before-after; sold+=amount; if(r[3])extra+=amount/r[3]; r[1]=after;
    }
    // Paused legacy sales also clamp the cached remaining amount.
    for(const r of rows)r[1]=Math.max(0,r[1]);
    const left=rows.reduce((a,r)=>a+r[1],0);
    copies=Math.min(header[1],copies+extra);earned+=sold;
    const rate=header[0]?rows.reduce((sum,r)=>sum+(r[0]?r[1]*Math.log(2)/(r[2]===0?3600:Math.max(1,r[2])):0),0):0;
    result.push(...[sold,left,copies,earned,rate,...(header[7]?rows.map(r=>r[1]):[])].map(milli));
  }
  return result;
}
const sales=spec('app-sales-settlement','Settle finite, decaying title sales','settle_sales',[parameter('header','std::vector<int>'),parameter('batches','std::vector<int>'),parameter('steps','std::vector<int>')],'std::vector<int>',`Settle a title's sales for each elapsed-time step, mutating state between steps. header=[active,totalCopies,soldCopies,salesEarned,unitPrice,salesRemaining,salesHalfLife,batchMode]. Flags are 0/1. batches concatenates [active,remaining,halfLife,unitPrice] records. It is empty outside batchMode. Negative remaining amounts count as 0; all other amounts and counts are nonnegative. Half-life may be negative: use 3600 for an exact zero, otherwise max(1,halfLife).\nFor elapsed seconds t use max(0,t). An active revenue stream with remaining amount R and effective half-life H sells amount A=R*(1-2^(-t/H)). Update its remaining amount to max(0,R-A). A paused title sells nothing. In batchMode, a paused batch also sells nothing.\nOutside batchMode the header defines the one stream. In batchMode only batches define streams; ignore header salesRemaining, salesHalfLife and unitPrice. For each active stream, add A/unitPrice to soldCopies when its unitPrice is nonzero. Clamp total soldCopies to totalCopies, even when t=0 or the title is paused. Increase salesEarned by the sum of amounts sold. Set salesRemaining to the sum of all nonnegative batch balances, including paused batches (or to the one stream's updated balance outside batchMode).\nCompute the instantaneous royalty after settlement: zero for a paused title; otherwise sum R*ln(2)/H over active streams only. For each step append [amountSold,salesRemaining,soldCopies,salesEarned,royalty], then the remaining amount of every batch in original order (no appended batch fields outside batchMode). Convert each output number x to floor(1000*x+0.5). Keep unrounded doubles between steps. Return these concatenated snapshots; empty steps gives an empty result.\nAt most 8 batches and 12 steps. Each initial balance<=100000, initial earned<=100000, totalCopies<=100000, unitPrice<=10000, halfLife in [-100,10000], seconds in [-100,20000]. In batchMode initial batch balances are nonnegative. All calculations use real-valued exponential decay; output quantization is only a wire format.`,[evidence('src/career.js',['export const remainingSales','export const titleSalesRate','export const salesDuring','export function settleSales'])],salesReference);

const debtReference=String.raw`std::vector<int> repair_debt(std::vector<int> header, std::vector<int> sources, std::vector<int> payments) {
    double debt = header[0];
    std::vector<double> amounts(sources.begin(),sources.end());
    auto breakdown = [&]() {
        double total = 0;
        for (double &x : amounts) { x = std::max(0.0,std::min(debt,x)); total += x; }
        if (total > debt && total) for (double &x : amounts) x *= debt/total;
        if (total < debt) {
            double gap = debt-total;
            int target = 4;
            if (total && gap <= std::max(1.0,debt)*1e-12) {
                for (int i = 0; i < 5; ++i) if (amounts[i] > 0) { target=i; break; }
            }
            amounts[target] += gap;
        }
    };
    std::vector<int> out;
    for (int requested : payments) {
        double paid = std::min(debt,double(requested)), fraction = debt ? (debt-paid)/debt : 0;
        breakdown(); debt = std::max(0.0,debt-paid);
        for (double &x : amounts) x *= fraction;
        out.push_back(int(std::floor(paid*1000+.5))); out.push_back(int(std::floor(debt*1000+.5)));
        for (double x : amounts) out.push_back(int(std::floor(x*1000+.5)));
    }
    return out;
}
`;
const causes=['temporary','coupling','verification','generated','reuse'];
function debtActual([header,sources,payments]) {
  const s={debt:header[0],debtSources:Object.fromEntries(causes.map((c,i)=>[c,sources[i]]))};
  return payments.flatMap(payment=>{const paid=repayDebt(s,payment);return [paid,s.debt,...causes.map(c=>s.debtSources[c])].map(milli);});
}
function debtIndependent([header,sources,payments]) {
  let balance=header[0],allocation=sources.slice();const out=[];
  for(const amount of payments){
    allocation=allocation.map(x=>Math.min(balance,Math.max(0,x)));
    const assigned=allocation.reduce((a,b)=>a+b,0);
    if(assigned>balance)allocation=allocation.map(x=>x*(balance/assigned));
    if(assigned<balance){const missing=balance-assigned;const target=assigned&&missing<=Math.max(1,balance)*1e-12?allocation.findIndex(x=>x>0):4;allocation[target]+=missing;}
    const paid=Math.min(balance,amount),retained=balance===0?0:(balance-paid)/balance;
    balance-=paid;allocation=allocation.map(x=>x*retained);
    out.push(...[paid,balance,...allocation].map(milli));
  }
  return out;
}
const debt=spec('app-debt-repayment','Reconcile and repay technical-debt causes','repair_debt',[parameter('header','std::vector<int>'),parameter('sources','std::vector<int>'),parameter('payments','std::vector<int>')],'std::vector<int>',`A technical-debt balance has five source amounts in the fixed order [temporary,coupling,verification,generated,reuse]. header=[debt]. Source amounts can be inconsistent with the authoritative nonnegative debt. payments contains nonnegative requested repayment amounts. Process each payment as follows.\nFirst compute paid=min(debt,requested), and fraction=(debt-paid)/debt (0 if debt=0). Reconcile sources against the debt BEFORE this payment: clamp each source to [0,debt], obtaining total. If total>debt, proportionally scale every source by debt/total. If total<debt, add gap=debt-total to reuse, except that when total>0 and gap<=max(1,debt)*1e-12, add the gap to the first positive source instead. Then reduce debt to max(0,debt-paid), and multiply every reconciled source by fraction. Keep unrounded values for the next payment.\nFor each payment append [paid,newDebt,temporary,coupling,verification,generated,reuse]. Convert each output x to floor(1000*x+0.5), only for output. Return the concatenated snapshots. There are exactly five source values and at most 20 payments. debt and requested payments are integers in [0,1000000], and sources are integers in [-1000000,1000000]. Empty payments yields an empty result.`,[evidence('src/maintenance.js',['export function debtBreakdown','export function repayDebt'])],debtReference);

const ocrReference=String.raw`std::vector<int> ocr_ledger(std::vector<int> operations) {
    struct Bucket { int count, rate, version, cursor; };
    std::vector<Bucket> queue;
    int fraction=0, cursor=0, repair=0, failures=0, corrected=0, fees=0, lastRate=0, lastVersion=0;
    bool fixed=false;
    std::vector<int> events;
    for (int i=0;i<int(operations.size());i+=4) {
        int errors=0,cancelled=0,fee=0,deduction=0,completed=0,recovered=0,used=0;
        if (operations[i]==0) {
            int equivalent=std::max(0,operations[i+1]),rate=operations[i+2],version=operations[i+3];
            if (version<1 || version>2) version=2;
            const std::vector<int> rates={1,2,3,5,8,12,18,24,30};
            bool accepted=equivalent>0 && std::find(rates.begin(),rates.end(),rate)!=rates.end();
            if (version<lastVersion || (fixed && rate!=1) || (rate<lastRate && rate!=1)) accepted=false;
            if (accepted) {
                if (rate<lastRate) fixed=true;
                lastRate=rate;lastVersion=version;
                int total=fraction+equivalent;errors=total/10;fraction=total%10;
                if (errors) {
                    if (!queue.empty() && queue.back().rate==rate && queue.back().version==version) queue.back().count+=errors;
                    else queue.push_back({errors,rate,version,cursor});
                    cursor=(cursor+errors%1280)%1280;failures+=errors;
                    cancelled=errors*100*rate;fee=errors*20*rate;deduction=cancelled+fee;fees+=fee;
                }
            }
        } else {
            int effort=std::max(0,operations[i+1]);
            if (queue.empty()) repair=0;
            else if (effort) {
                int before=repair,total=before+effort,remaining=total/100;
                while (remaining && !queue.empty()) {
                    Bucket &b=queue.front();int n=std::min(remaining,b.count);
                    completed+=n;recovered+=n*100*b.rate;remaining-=n;b.count-=n;b.cursor=(b.cursor+n%1280)%1280;
                    if (!b.count) queue.erase(queue.begin());
                }
                corrected+=completed;repair=queue.empty()?0:total-completed*100;
                used=queue.empty()?std::min(effort,std::max(0,completed*100-before)):effort;
            }
        }
        events.insert(events.end(),{errors,cancelled,fee,deduction,completed,recovered,used});
    }
    int pending=0,reward=0;
    for (const Bucket &b:queue) { pending+=b.count;reward+=b.count*100*b.rate; }
    std::vector<int> out={int(operations.size())/4};
    out.insert(out.end(),events.begin(),events.end());
    out.insert(out.end(),{fraction,cursor,repair,pending,reward,failures,corrected,fees,lastRate,lastVersion,fixed?1:0,int(queue.size())});
    for (const Bucket &b:queue) out.insert(out.end(),{b.count,b.rate,b.version,b.cursor});
    return out;
}
`;
function ocrActual([operations]) {
  const l=createOCRLedger(),events=[];
  for(let i=0;i<operations.length;i+=4){
    if(operations[i]===0){const r=recordOCR(l,operations[i+1],operations[i+2],{version:operations[i+3]});events.push(r.errors,r.cancelled,r.fee,r.deduction,0,0,0);}
    else{const r=correctOCR(l,operations[i+1]);events.push(0,0,0,0,r.completed,r.recovered,r.workUsed);}
  }
  return [operations.length/4,...events,l.fraction,l.cursor,l.repairProgress,l.pending,l.pendingReward,l.failures,l.corrected,l.fees,l.lastRate,l.lastVersion,l.fixedRate?1:0,l.buckets.length,...l.buckets.flatMap(b=>[b.count,b.rate,b.version,b.cursor])];
}
// Independent oracle keeps individual unpaid orders, rather than production buckets.
function ocrIndependent([operations]) {
  let fraction=0,cursor=0,repair=0,failures=0,corrected=0,fees=0,lastRate=0,lastVersion=0,fixed=0;
  const unpaid=[],events=[],rates=new Set([1,2,3,5,8,12,18,24,30]);
  for(let at=0;at<operations.length;at+=4){
    let event=Array(7).fill(0);
    if(operations[at]===0){
      const equivalent=Math.max(0,operations[at+1]),rate=operations[at+2],version=[1,2].includes(operations[at+3])?operations[at+3]:2;
      if(equivalent>0&&rates.has(rate)&&version>=lastVersion&&(!fixed||rate===1)&&(rate>=lastRate||rate===1)){
        if(rate<lastRate)fixed=1;lastRate=rate;lastVersion=version;
        const errors=Math.trunc((fraction+equivalent)/10);fraction=(fraction+equivalent)%10;
        for(let i=0;i<errors;i++)unpaid.push({rate,version,cursor:(cursor+i)%1280});
        cursor=(cursor+errors)%1280;failures+=errors;fees+=errors*20*rate;
        event=[errors,errors*100*rate,errors*20*rate,errors*120*rate,0,0,0];
      }
    }else{
      const effort=Math.max(0,operations[at+1]);
      if(!unpaid.length)repair=0;
      else if(effort>0){
        const old=repair,count=Math.min(unpaid.length,Math.floor((repair+effort)/100));
        const recovered=unpaid.splice(0,count).reduce((a,row)=>a+100*row.rate,0);
        corrected+=count;repair=unpaid.length?(old+effort)-100*count:0;
        event=[0,0,0,0,count,recovered,unpaid.length?effort:Math.min(effort,Math.max(0,count*100-old))];
      }
    }
    events.push(...event);
  }
  const buckets=[];
  for(const item of unpaid){const last=buckets.at(-1);if(last&&last.rate===item.rate&&last.version===item.version)last.count++;else buckets.push({count:1,...item});}
  return [operations.length/4,...events,fraction,cursor,repair,unpaid.length,unpaid.reduce((a,b)=>a+100*b.rate,0),failures,corrected,fees,lastRate,lastVersion,fixed,buckets.length,...buckets.flatMap(b=>[b.count,b.rate,b.version,b.cursor])];
}
const ocr=spec('app-ocr-correction-ledger','OCR chargebacks and FIFO correction','ocr_ledger',[parameter('operations','std::vector<int>')],'std::vector<int>',`Process a fresh OCR correction ledger. operations concatenates four-integer records. [0,equivalentOrders,rate,version] records already-paid OCR orders; [1,repairWork,0,0] applies correction work. Initial counters, fraction, cursor, repairProgress, lastRate and lastVersion are 0; fixedRate is false; the FIFO bucket queue is empty. Allowed rates are 1,2,3,5,8,12,18,24,30; versions are 1 or 2. Every cursor wraps modulo 1280.\nRECORD: clamp equivalentOrders to at least 0; reject an operation with zero equivalents or an unlisted rate. Replace a version outside {1,2} with 2. Reject a version below lastVersion. If fixedRate is true, reject rates other than 1. If rate<lastRate, reject unless rate=1; accepting that downward transition sets fixedRate=true permanently. A rejected operation changes nothing. For an accepted operation, set lastRate and lastVersion even if no error is generated. Let total=fraction+equivalentOrders; errors=floor(total/10); fraction=total%10. With positive errors, merge them into the last bucket if rate and version match, otherwise append [errors,rate,version,current cursor]. Advance cursor by errors modulo 1280; add errors to failures. cancelled=errors*100*rate, fee=errors*20*rate, deduction=cancelled+fee. Add fee to cumulative fees. No errors gives a zero event.\nCORRECT: clamp repairWork to at least 0. If no buckets, clear repairProgress and emit a zero event. If effort is zero, change nothing. Otherwise total=old repairProgress+effort; correct floor(total/100) orders, limited to those pending, oldest first. Each corrected order recovers 100*its bucket rate; advance that bucket's cursor by the number removed modulo 1280 and drop emptied buckets. Add the number corrected to corrected. If any order remains, repairProgress=total-100*completed and workUsed=effort; otherwise repairProgress=0 and workUsed=min(effort,max(0,100*completed-old repairProgress)). Fees are never refunded, and excess work is not banked.\nReturn operation count, then seven event fields for EACH operation in order: [errors,cancelled,fee,deduction,completed,recovered,workUsed] (the other kind's fields are zero). Then append the final state [fraction,cursor,repairProgress,pending,pendingReward,failures,corrected,fees,lastRate,lastVersion,fixedRate,bucketCount], followed by each remaining bucket [count,rate,version,cursor]. pending is total unpaid orders; pendingReward is sum(count*100*rate). There are at most 100 operations, equivalentOrders in [-20,20000], repairWork in [-20,1000000], rate in [-2,32], version in [-2,4]. All cumulative totals fit signed 32-bit integers.`,[evidence('src/officequality.js',['export function createOCRLedger','function summarize','export function recordOCR','export function correctOCR'])],ocrReference);

let randomState=0x35dc0f21;
const rand=n=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return (randomState>>>0)%n;};
function fixture(task,id,args,actual,independent,publicExample=false) {
  const expected=actual(clone(args)),other=independent(clone(args));
  if(!equal(expected,other))throw Error(`${task.id}/${id}: source/oracle mismatch\n${JSON.stringify({args,expected,other})}`);
  task.fixtures.push({id,visibility:publicExample?'public':'hidden',args,expected});
}
function prepareFixtures() {
  if(keys.fixtures.length)return;
  const keyValues=['','a','    int x;\n        return x;','   a     b\t c\r\n',...Array.from({length:17},(_,i)=>' '.repeat(i)), '   \t    \n     ',String.raw`const char* s = "a\\b";`];
  for(let i=0;i<keyValues.length;i++)fixture(keys,`shape-${i}`,[keyValues[i]],args=>typingKeystrokes(args[0]),keyIndependent,i<3);
  for(let i=0;i<37;i++)fixture(keys,`random-${i}`,[Array.from({length:rand(400)},()=>[' ',' ',' ','\n','\t','\r','a','0','{','}'][rand(10)]).join('')],args=>typingKeystrokes(args[0]),keyIndependent);
  for(let i=0;i<=12;i++)fixture(experience,`index-${i}`,[i],experienceActual,experienceIndependent,[0,2,4].includes(i));
  const rec=(...rows)=>rows.flat();
  const buildCases=[
    [[100,10,60,200],[],[],[]],
    [[100,10,60,200],[5,5,20,80,7,3],[0,1,4,150,3,30,0],[]],
    [[100,10,60,200],[5,9,20,80,7,3],[7,0,2,30,3,20,1],rec([0,0,2,30,3,20,1])],
    [[10,2,20,100],[-1,5,-4,30,8,-1],[3,6,10,200,-1,50,-4],rec([2,2,10,50,4,10,2],[-1,0,0,0,0,0,0])],
    [[100,10,60,200],[5,4,3,2,1,0],[],rec(...Array.from({length:8},(_,i)=>[i===4?9:0,0,i,10,3,20,1]))]
  ];
  buildCases.forEach((a,i)=>fixture(builds,`edge-${i}`,a,buildActual,buildIndependent,i<3));
  for(let i=0;i<55;i++){
    const state=[rand(400),rand(40),rand(100),rand(800)];
    const header=Array.from({length:6},()=>rand(500)-20);
    const row=()=>[rand(7)-1,rand(10)-1,rand(500)-20,rand(900)-20,rand(80)-20,rand(150)-20,rand(8)-2];
    fixture(builds,`random-${i}`,[state,header,rand(3)?row():[],Array.from({length:rand(15)},row).flat()],buildActual,buildIndependent);
  }
  const saleCases=[
    [[1,1000,0,0,10,1000,3600,0],[],[3600,3600]],
    [[1,1000,0,0,999,999,999,1],[1,1000,3600,10,0,800,3600,20],[3600,0]],
    [[0,10,15,7,10,1000,3600,0],[],[3600]],
    [[1,100,0,0,0,100,0,0],[],[-1,0,3600]],
    [[1,100,0,0,1,99,1,1],[],[0,1]],
    [[1,10,3,8,0,-30,-10,0],[],[2,3]],
    [[1,100,0,0,10,1000,-1,0],[],[1,2]],
    [[1,100,0,0,10,1000,3600,0],[],[]],
  ];
  saleCases.forEach((a,i)=>fixture(sales,`edge-${i}`,a,salesActual,salesIndependent,i<3));
  for(let i=0;i<52;i++){
    const batched=rand(2),h=[rand(2),rand(10000),rand(11000),rand(1000),rand(4)?rand(300)+1:0,rand(50000),[0,-10,1,60,3600,7200][rand(6)],batched];
    const b=batched?Array.from({length:rand(6)},()=>[rand(2),rand(40000),[0,-5,1,30,3600,7200][rand(6)],rand(4)?rand(500)+1:0]).flat():[];
    fixture(sales,`random-${i}`,[h,b,Array.from({length:rand(10)},()=>rand(15000)-20)],salesActual,salesIndependent);
  }
  const debtCases=[
    [[100],[20,30,0,0,0],[10,30,100]],
    [[100],[100,100,100,-5,100],[0,25]],
    [[0],[5,5,5,5,5],[10,0]],
    [[1000],[0,0,0,0,0],[1,2,3]],
    [[99],[3,7,19,31,39],[]],
  ];
  debtCases.forEach((a,i)=>fixture(debt,`edge-${i}`,a,debtActual,debtIndependent,i<3));
  for(let i=0;i<55;i++)fixture(debt,`random-${i}`,[[rand(1000000)],Array.from({length:5},()=>rand(1500000)-500000),Array.from({length:rand(12)},()=>rand(100000))],debtActual,debtIndependent);
  const operations=[
    [],[0,10,1,2],[0,9,1,2,0,1,1,2,1,50,0,0,1,100,0,0],
    [0,20,3,1,0,10,5,2,1,250,0,0],
    [0,5,12,1,0,5,1,2,0,10,2,2,0,10,1,1,0,10,1,2],
    [0,12810,1,2,1,128050,0,0,0,10,1,2],
    [1,500,0,0,0,10,1,2,1,1000000,0,0,1,500,0,0],
    [0,-1,1,2,0,10,4,1,0,10,2,4,0,10,3,1],
    [0,1,30,1,0,9,24,1,0,9,1,1,0,1,1,2,0,10,30,2],
  ];
  operations.forEach((ops,i)=>fixture(ocr,`edge-${i}`,[ops],ocrActual,ocrIndependent,i<3));
  for(let i=0;i<51;i++){
    const ops=Array.from({length:rand(50)},()=>rand(3)?[0,rand(500)-3,[-1,0,1,2,3,4,5,8,12,18,24,30,32][rand(13)],rand(7)-2]:[1,rand(3000)-3,0,0]).flat();
    fixture(ocr,`random-${i}`,[ops],ocrActual,ocrIndependent);
  }
}

export function appCalibrationTasks() {
  prepareFixtures();
  return [keys,experience,builds,debt,sales,ocr].map(task=>({ ...task, publicSpec:{...task.publicSpec,examples:task.fixtures.filter(x=>x.visibility==='public').map(({args,expected})=>({args,expected}))}, referenceMetrics:metrics(task.referenceSource), oracleValidation:{sourceImplementationCompared:true,independentOracleCompared:true,caseCount:task.fixtures.length,publicCaseCount:task.fixtures.filter(x=>x.visibility==='public').length} }));
}
function cppValue(value,type) { if(type==='std::string')return JSON.stringify(value); if(type==='int')return String(value);return `{${value.join(',')}}`; }
export function createAppHarness(task, source) {
  const cases=task.fixtures||task.cases;
  return `#include <algorithm>\n#include <cmath>\n#include <string>\n#include <vector>\n#include <iostream>\n#include <iomanip>\n${source}\nvoid emit(int x) { std::cout << x; }\nvoid emit(const std::vector<int>& xs) { std::cout << '[';for (std::size_t i=0;i<xs.size();++i) { if(i)std::cout<<',';std::cout<<xs[i]; }std::cout<<']'; }\nint main() {\n${cases.map(c=>`emit(${task.publicSpec.entryPoint}(${c.args.map((v,i)=>cppValue(v,task.publicSpec.parameters[i].cppType)).join(',')})); std::cout << '\\n';`).join('\n')}\n}\n`;
}
export async function validateAppReferences(tasks=appCalibrationTasks()) {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'cti-app-calibration-'));
  try {
    const results=[];
    for(const task of tasks){
      const file=path.join(temporary,task.id+'.cpp'),exe=path.join(temporary,task.id);
      fs.writeFileSync(file,createAppHarness(task,task.referenceSource));
      await execute('g++',['-std=c++17','-O2','-Wall','-Wextra',file,'-o',exe],{encoding:'utf8',timeout:60000});
      const {stdout}=await execute(exe,[],{encoding:'utf8',timeout:10000});
      const rows=stdout.trim().split('\n').map(x=>JSON.parse(x));
      const failed=task.fixtures.filter((c,i)=>!equal(c.expected,rows[i]));
      if(failed.length)throw Error(`${task.id}: C++ reference failed ${failed.length} case(s): ${failed[0].id}\n${JSON.stringify({expected:failed[0].expected,actual:rows[task.fixtures.indexOf(failed[0])]})}`);
      results.push({id:task.id,passed:rows.length,total:task.fixtures.length,compiler:'g++ -std=c++17 -O2 -Wall -Wextra'});
    }
    return results;
  } finally { fs.rmSync(temporary,{recursive:true,force:true}); }
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const tasks=appCalibrationTasks(),validation=await validateAppReferences(tasks);
  const revision=await execute('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
  const registry={schemaVersion:1,purpose:'Real application-logic anchors for comparing model solve time and implementation volume. These are bounded, documented C++ ports, not claims of complete application or language mastery.',sourceRevision:revision.stdout.trim(),promptBoundary:'Only publicSpec is supplied to a measured solver. Metadata, test cases, referenceMetrics and this author module must not be included in its prompt.',numericPolicy:'Integer inputs. Sales/debt keep double internal state and quantize outputs to thousandths. Test expectations are cross-checked between actual production JS, independently structured JS oracles, and native C++ references.',sourceMetricPolicy:'Selected function spans include their original bodies, but exclude external constants unless listed; selectedLogicMetrics therefore measure original selected spans, not the whole subsystem. C++ referenceMetrics cover submitted implementation only, excluding harness and includes. physicalTypingKeys uses the game rule: each run of ordinary spaces costs ceil(length/4), all other characters one.',validation,tasks:tasks.map(({referenceSource,fixtures,...task})=>({...task,cases:fixtures}))};
  fs.writeFileSync(path.join(root,'research/calibration-app-tasks.json'),JSON.stringify(registry,null,2)+'\n');
  console.log(JSON.stringify({written:'research/calibration-app-tasks.json',tasks:validation},null,2));
}
