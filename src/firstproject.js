// The first game is assembled from three independently tested components.
// These exercises are project work, with no claim of completing a typing lesson.
export const FIRST_PROJECT_VERSION = 1;
// A curriculum budget, independent of a reference answer's spelling or size.
// The freeze script verifies this is ceil(study work needed for free K0→K12).
export const FIRST_PROJECT_FOUNDATION_WORK = 10058;
export const FIRST_PROJECT_STUDY_BASE = FIRST_PROJECT_FOUNDATION_WORK / 12;
export const FIRST_PROJECT_LANGUAGES = Object.freeze(['cpp', 'csharp', 'rust', 'go', 'python', 'java', 'sql', 'lua']);
export const FIRST_PROJECT_PARTS = Object.freeze([
 Object.freeze({id:'accept-guess',title:'入力を受け付ける',description:'入力された数が、数当てゲームで受け付ける範囲に入っているかを判定する。',index:0,end:1000}),
 Object.freeze({id:'compare-guess',title:'正解と比べる',description:'入力された予想と正解を比べ、「もっと大きい」「正解」「もっと小さい」の案内を選ぶ。',index:1,end:2000}),
 Object.freeze({id:'round-status',title:'勝敗と残り回数を決める',description:'今回の予想が当たったか、外れた場合にもう一度予想できるかを判定する。',index:2,end:3000})
]);
const INT_MIN=-2147483648, INT_MAX=2147483647;
const DEFINITIONS = [
 {
  functionId:'accept_guess',
  parameters:[
   {name:'value',type:'int',description:'今回入力された予想の数値。'},
   {name:'low',type:'int',description:'受け付ける数値の下限。この値と等しい予想も受け付ける。'},
   {name:'high',type:'int',description:'受け付ける数値の上限。この値と等しい予想も受け付ける。'}
  ],
  description:'valueがlow以上、かつhigh以下なら1、それ以外なら0を返す。両端を含む。lowとhighが等しい場合は、その値だけを受け付ける。lowがhighより大きい場合は、受け付ける値がないので必ず0を返す。引数は符号付き32bit整数で、数値の差を計算する必要はない。',
  comments:['Accept guesses inside the inclusive input range.'],
  inputs:[[0,0,0],[-1,0,0],[1,0,0],[0,0,10],[10,0,10],[1,0,10],[9,0,10],[11,0,10],[-1,0,10],[-10,-10,-1],[-1,-10,-1],[-11,-10,-1],[0,-10,-1],[-5,-10,-1],[5,10,0],[INT_MIN,INT_MIN,INT_MAX],[INT_MAX,INT_MIN,INT_MAX],[INT_MIN+1,INT_MIN,INT_MIN+1],[INT_MAX-1,INT_MAX-1,INT_MAX],[INT_MIN,INT_MIN+1,INT_MAX],[INT_MAX,INT_MIN,INT_MAX-1],[0,-1,1],[6,5,5],[5,5,5]],
  expected:([value,low,high])=>value>=low&&value<=high?1:0,
  sql:'SELECT CASE WHEN value >= low AND value <= high THEN 1 ELSE 0 END AS accepted FROM input;'
 },
 {
  functionId:'compare_guess',
  parameters:[
   {name:'guess',type:'int',description:'今回プレイヤーが予想した数値。'},
   {name:'secret',type:'int',description:'ゲームが保持している正解の数値。'}
  ],
  description:'guessがsecretより小さければ-1、同じなら0、大きければ1を返す。-1は「もっと大きい数を予想する」、1は「もっと小さい数を予想する」という案内に使う。引数は符号付き32bit整数。最大値と最小値の比較でも正しく動くよう、引き算の結果を判定するのではなく大小を比較する。',
  comments:['Compare the guess directly with the secret to choose a hint.'],
  inputs:[[-1,0],[0,0],[1,0],[0,-1],[-1,-1],[-2,-1],[10,10],[9,10],[11,10],[-10,-10],[-11,-10],[-9,-10],[INT_MIN,INT_MIN],[INT_MAX,INT_MAX],[INT_MIN,INT_MAX],[INT_MAX,INT_MIN],[INT_MIN+1,INT_MIN],[INT_MIN,INT_MIN+1],[INT_MAX-1,INT_MAX],[INT_MAX,INT_MAX-1],[0,INT_MAX],[0,INT_MIN],[42,43],[43,42]],
  expected:([guess,secret])=>guess<secret?-1:guess>secret?1:0,
  sql:'SELECT CASE WHEN guess < secret THEN -1 WHEN guess > secret THEN 1 ELSE 0 END AS comparison FROM input;'
 },
 {
  functionId:'round_status',
  parameters:[
   {name:'guess',type:'int',description:'今回プレイヤーが予想した数値。'},
   {name:'secret',type:'int',description:'ゲームが保持している正解の数値。'},
   {name:'remaining',type:'int',description:'今回の予想を送る直前に残っていた回数。今回の判定後に1回消費するため、1なら今回が最後の予想。'}
  ],
  description:'まずguessとsecretの一致を判定し、一致なら残り回数に関係なく1（勝利）を返す。外れた場合、remainingが1以下なら-1（終了）、2以上なら0（継続）を返す。remainingは今回の予想を送る直前の回数で、今回の判定で1回使う。0や負数が渡された場合も、一致なら勝利、外れなら終了とする。引数は符号付き32bit整数。ここでは回数そのものを更新せず、次のゲーム状態を表す整数を返す。',
  comments:['A correct guess wins even on the final attempt.','A wrong guess uses the attempt counted in remaining.'],
  inputs:[[0,0,2],[0,0,1],[0,0,0],[0,0,-1],[1,0,2],[-1,0,2],[1,0,1],[-1,0,1],[1,0,0],[-1,0,-1],[5,5,10],[5,6,10],[6,5,10],[-5,-5,1],[-5,-4,1],[INT_MIN,INT_MIN,1],[INT_MAX,INT_MAX,0],[INT_MIN,INT_MAX,1],[INT_MAX,INT_MIN,2],[INT_MIN,INT_MAX,INT_MAX],[INT_MAX,INT_MIN,INT_MIN],[1,1,INT_MIN],[INT_MIN,INT_MIN,INT_MAX],[-42,42,3]],
  expected:([guess,secret,remaining])=>guess===secret?1:remaining<=1?-1:0,
  sql:'SELECT CASE WHEN guess = secret THEN 1 WHEN remaining <= 1 THEN -1 ELSE 0 END AS status FROM input;'
 }
];
const cache=new Map();
function nameFor(language,id) {
 const camel=id.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase());
 return language==='csharp'?camel[0].toUpperCase()+camel.slice(1):['go','java'].includes(language)?camel:id;
}
function signature(language,name,parameters) {
 const args=parameters.map(p=>language==='rust'?`${p.name}: i32`:language==='go'?`${p.name} int`:['python','lua'].includes(language)?p.name:`int ${p.name}`).join(', ');
 if(language==='python')return `def ${name}(${args}):`;
 if(language==='lua')return `function ${name}(${args})`;
 if(language==='rust')return `fn ${name}(${args}) -> i32 {`;
 if(language==='go')return `func ${name}(${args}) int {`;
 return `${['csharp','java'].includes(language)?'static ':''}int ${name}(${args}) {`;
}
function returnLine(language,value) { return `return ${value}${['cpp','csharp','java','rust'].includes(language)?';':''}`; }
function conditional(language,test,result) {
 if(language==='python')return `if ${test}:\n    ${returnLine(language,result)}`;
 if(language==='lua')return `if ${test} then\n    ${returnLine(language,result)}\nend`;
 return `if ${['cpp','csharp','java'].includes(language)?'('+test+')':test} {\n    ${returnLine(language,result)}\n}`;
}
function wrapFunction(language,name,parameters,body) {
 return signature(language,name,parameters)+'\n'+body.split('\n').map(line=>'    '+line).join('\n')+(language==='python'?'':language==='lua'?'\nend':'\n}');
}
function referenceFor(language,index,def,name) {
 const marker=language==='python'?'#':language==='lua'?'--':'//';
 const note=i=>marker+' '+def.comments[i];
 let body;
 if(index===0)body=note(0)+'\n'+conditional(language,language==='python'?'value >= low and value <= high':language==='lua'?'value >= low and value <= high':'value >= low && value <= high',1)+'\n'+returnLine(language,0);
 else if(index===1)body=note(0)+'\n'+conditional(language,'guess < secret',-1)+'\n'+conditional(language,'guess > secret',1)+'\n'+returnLine(language,0);
 else body=note(0)+'\n'+conditional(language,language==='python'||language==='lua'?'guess == secret':'guess == secret',1)+'\n'+note(1)+'\n'+conditional(language,'remaining <= 1',-1)+'\n'+returnLine(language,0);
 return wrapFunction(language,name,def.parameters,body);
}
function codeHarness(quiz,source) {
 const calls=quiz.cases.map(c=>`${quiz.functionName}(${c.args.join(', ')})`);
 let program;
 if(quiz.language==='cpp')program='#include <iostream>\n'+source+'\nint main() {\n'+calls.map(call=>`std::cout << ${call} << "\\n";`).join('\n')+'\n}\n';
 else if(quiz.language==='csharp')program='class Program {\n'+source+'\nstatic void Main(string[] args) {\n'+calls.map(call=>`System.Console.WriteLine(${call});`).join('\n')+'\n}\n}\n';
 else if(quiz.language==='java')program='public class Main {\n'+source+'\npublic static void main(String[] args) {\n'+calls.map(call=>`System.out.println(${call});`).join('\n')+'\n}\n}\n';
 else if(quiz.language==='rust')program=source+'\nfn main() {\n'+calls.map(call=>`println!("{}", ${call});`).join('\n')+'\n}\n';
 else if(quiz.language==='go')program='package main\nimport "fmt"\n'+source+'\nfunc main() {\n'+calls.map(call=>`fmt.Println(${call})`).join('\n')+'\n}\n';
 else program=source+'\n'+calls.map(call=>`print(${call})`).join('\n')+'\n';
 return {language:quiz.language,source:program,expected:quiz.cases.map(c=>c.expected),caseIds:quiz.cases.map(c=>c.id),fileName:quiz.language==='java'?'Main.java':undefined};
}
function inputFixture(columns,rows) {
 return 'DROP TABLE IF EXISTS input;\nCREATE TABLE input ('+columns.map(name=>name+' INTEGER NOT NULL').join(', ')+');\nINSERT INTO input VALUES '+rows.map(row=>'('+row.join(', ')+')').join(', ')+';\n';
}
function sqlHarness(quiz,source) {
 const executions=quiz.cases.map(c=>({source,fixtureSql:inputFixture(c.fixtureColumns,c.fixtureRows),expected:c.expected}));
 return {language:'sql',source:executions.map(e=>e.fixtureSql+source+'\n').join('\n'),expected:quiz.cases.map(c=>c.expected),caseIds:quiz.cases.map(c=>c.id),executions};
}
export function firstProjectQuizAt(language,index) {
 if(!FIRST_PROJECT_LANGUAGES.includes(language))throw new RangeError(`Unsupported first-project language: ${language}`);
 if(!Number.isInteger(index)||index<0||index>=FIRST_PROJECT_PARTS.length)return null;
 const part=FIRST_PROJECT_PARTS[index],id=`first-build/v${FIRST_PROJECT_VERSION}/${language}/${part.id}`;
 if(cache.has(id))return cache.get(id);
 const def=DEFINITIONS[index],name=language==='sql'?null:nameFor(language,def.functionId),parameters=def.parameters.map(p=>({...p})),columns=parameters.map(p=>p.name);
 const referenceSource=language==='sql'?def.comments.map(c=>'-- '+c).join('\n')+'\n'+def.sql:referenceFor(language,index,def,name);
 const marker=language==='python'?'#':language==='lua'?'--':'//';
 const starterSource=language==='sql'?'-- Return the result for this guess from the input row.\nSELECT 0 FROM input;':wrapFunction(language,name,parameters,marker+' Implement this part of the guessing game.\n'+returnLine(language,0));
 const cases=def.inputs.map((args,i)=>({id:`case-${String(i+1).padStart(2,'0')}`,args:[...args],expected:def.expected(args),...(language==='sql'?{fixtureTable:'input',fixtureColumns:[...columns],fixtureRows:[[...args]]}:{})}));
 const quiz={id,version:FIRST_PROJECT_VERSION,language,subject:'syntax',index,topicId:def.functionId,title:part.title,description:def.description,functionName:name,parameters,referenceSource,starterSource,rewardSource:referenceSource,cases,firstProjectPart:index,firstProjectPartId:part.id,lessonBaseId:null,supported:true,limitations:[],...(language==='sql'?{fixtureTable:'input',fixtureColumns:[...columns]}:{})};
 quiz.createHarness=source=>language==='sql'?sqlHarness(quiz,source):codeHarness(quiz,source);
 cache.set(id,quiz);
 return quiz;
}
export function firstProjectQuizById(id) {
 if(typeof id!=='string')return null;
 const fields=id.split('/');
 if(fields.length!==4||fields[0]!=='first-build'||fields[1]!==`v${FIRST_PROJECT_VERSION}`||!FIRST_PROJECT_LANGUAGES.includes(fields[2]))return null;
 const index=FIRST_PROJECT_PARTS.findIndex(part=>part.id===fields[3]);
 return index<0?null:firstProjectQuizAt(fields[2],index);
}
export function firstProjectQuizCatalog() { return FIRST_PROJECT_LANGUAGES.flatMap(language=>FIRST_PROJECT_PARTS.map(part=>firstProjectQuizAt(language,part.index))); }
