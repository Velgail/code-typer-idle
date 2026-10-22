// Export only player-facing input for a blind solver. References and hidden
// cases stay out of this snapshot; grading is performed by a separate command.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {challengeById} from '../src/challengecatalog.js';

if(process.argv.length!==4){
 console.error('Usage: node scripts/export-challenge-prompt.mjs CHALLENGE_ID OUTPUT.json');
 process.exit(2);
}
const [id,path]=process.argv.slice(2),q=challengeById(id);
if(!q||q.language==='sql')throw Error('Expected a programming-language Challenge ID.');
const prompt={id:q.id,title:q.title,description:q.description,constraints:q.constraints,parameters:q.parameters,resultType:q.resultType,examples:q.examples||q.cases.slice(0,2).map(({args,expected})=>({args,expected})),starterSource:q.starterSource};
const bytes=JSON.stringify(prompt,null,2)+'\n';
await mkdir(dirname(path),{recursive:true});
await writeFile(path,bytes,{flag:'wx'});
console.log(JSON.stringify({id:q.id,path,sha256:createHash('sha256').update(bytes).digest('hex')}));
