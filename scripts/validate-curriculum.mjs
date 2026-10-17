// Execute the emitted source, independently of the JavaScript answer evaluator.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { lessonAt, functionName, TOPICS } from '../src/curriculum.js';
const languages = ['cpp','csharp','rust','go','python','java','sql','lua'];
const all = Object.fromEntries(languages.map(language => [language, Object.keys(TOPICS).flatMap(subject => Array.from({length:256}, (_,index) => lessonAt(language,subject,index)))]));
await mkdir('work', {recursive:true});
const dir = resolve(await mkdtemp('work/curriculum-'));
function run(command,args=[],input) {
 const result=spawnSync(command,args,{encoding:'utf8',input,maxBuffer:8e6,timeout:120000});
 if(result.error || result.status!==0) throw new Error(`${command}: ${result.error || result.stderr || result.stdout}`);
 return result.stdout.trim();
}
const installed = command => {
 if (spawnSync('which',[command],{encoding:'utf8'}).status !== 0) return false;
 return command !== 'go' || /^go version/.test(spawnSync('go',['version'],{encoding:'utf8'}).stdout || '');
};
const strict = process.argv.includes('--all');
const checked=[], skipped=[];
async function compiled(language, compiler, filename, prefix, suffix, call, compile, execute) {
 if(!installed(compiler)){skipped.push(language);if(strict)throw new Error(`Missing ${compiler}`);return;}
 const lessons=all[language];
 const names=lessons.map((l,i)=>`${functionName(language,l.topicId)}_v${i}`);
 const source=lessons.map((l,i)=>l.code.replace(functionName(language,l.topicId),names[i])).join('\n');
 const body=lessons.map((l,i)=>call(names[i])).join('\n');
 const path=resolve(dir,filename);await writeFile(path,prefix+source+suffix(body));
 if(compile)run(compiler,compile(path));
 const result=run(...execute(path)).split(/\r?\n/).map(Number);
 assert.deepEqual(result,lessons.map(l=>l.answer),language);
 checked.push(`${language}: ${lessons.length}`);
}
try {
 await compiled('cpp','g++','examples.cpp','#include <iostream>\n',b=>`\nint main(){\n${b}\n}`,n=>`std::cout << ${n}() << "\\n";`,p=>['-std=c++17',p,'-o',resolve(dir,'cpp')],()=>[resolve(dir,'cpp')]);
 await compiled('go','go','examples.go','package main\nimport "fmt"\n',b=>`\nfunc main(){\n${b}\n}`,n=>`fmt.Println(${n}())`,null,p=>['go',['run',p]]);
 await compiled('rust','rustc','examples.rs','',b=>`\nfn main(){\n${b}\n}`,n=>`println!("{}", ${n}());`,p=>['-Awarnings',p,'-o',resolve(dir,'rust')],()=>[resolve(dir,'rust')]);
 await compiled('java','javac','Examples.java','class Examples {\n',b=>`\npublic static void main(String[] args){\n${b}\n}\n}`,n=>`System.out.println(${n}());`,p=>[p],()=>['java',['-cp',dir,'Examples']]);
 await compiled('csharp','mcs','Examples.cs','class Examples {\n',b=>`\nstatic void Main(){\n${b}\n}\n}`,n=>`System.Console.WriteLine(${n}());`,p=>['-out:'+resolve(dir,'csharp.exe'),p],()=>['mono',[resolve(dir,'csharp.exe')]]);
 await compiled('lua','lua','examples.lua','',b=>'\n'+b,n=>`print(${n}())`,null,p=>['lua',[p]]);
 const python = `import sys,json,sqlite3\npayload=json.load(sys.stdin)\nfor lesson in payload['python']:\n env={}\n exec(compile(lesson['code'],lesson['id'],'exec'),env)\n result=env[lesson['topicId']]()\n assert result==lesson['answer'],(lesson['id'],result,lesson['answer'])\nconn=sqlite3.connect(':memory:')\nfor lesson in payload['sql']:\n result=conn.execute(lesson['code']).fetchone()[0]\n assert result==lesson['answer'],(lesson['id'],result,lesson['answer'])\nprint('python: '+str(len(payload['python']))+'; sql: '+str(len(payload['sql'])))\n`;
 checked.push(run('python3',['-c',python],JSON.stringify({python:all.python,sql:all.sql})));
 console.log('Executed and checked: '+checked.join('; '));
 if(skipped.length)console.log('Compilers unavailable (not executed): '+skipped.join(', '));
} finally { await rm(dir,{recursive:true,force:true}); }
