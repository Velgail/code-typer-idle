import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, cp, stat } from 'node:fs/promises';

const PIPELINE_VERSION = 4;
const root = new URL('../docs/', import.meta.url);
const license = await readFile(new URL('../LICENSE', root), 'utf8');
const licenseHeader = `/*\n${license}\n*/\n`;
const modules = ['app', 'core', 'career', 'typing', 'codehighlight', 'codeeditor', 'typinghighlight', 'readingchoices', 'readingchoices/shared', 'readingchoices/idioms', 'readingchoices/sql', 'updates', 'office', 'officequality', 'curriculum', 'idioms', 'courses', 'learningguide', 'maintenance', 'builds', 'course', 'planning', 'planningcatalog', 'planningrules', 'planningtechnology', 'planninggameplay', 'planningbusiness', 'plannerstate', 'quizcatalog', 'challengestatements', 'challengecatalog', 'challengesql', 'skillquiz', 'skillquizui', 'skillquizdata/cpprust', 'skillquizdata/csharpjava', 'skillquizdata/go-python', 'skillquizdata/lua-sql', 'firstproject', 'quizrunner', 'quizworker', 'quizui', ...['cpp','csharp','rust','go','python','java','sql','lua'].map(language=>`runners/${language}`)];
modules.push('challengerewards', 'challengeaccess', 'contestchallenges', 'contractchallenges', 'compounddelivery', 'compoundroute', 'hardconnectivity', 'hardsequence', 'hardfrontier');
const sources = await Promise.all(modules.map(name => readFile(new URL(`../src/${name}.js`, root), 'utf8')));
const css = (await Promise.all(['docs/style.css','styles/quiz.css','styles/codehighlight.css','styles/codeeditor.css','styles/typinghighlight.css','styles/readingchoices.css'].map(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')))).join('\n');
const htmlPath = new URL('index.html', root);
const template = (await readFile(htmlPath, 'utf8'))
  .replace(/<link rel="stylesheet" href="[^"]+">/, '<link rel="stylesheet" href="__STYLE__">')
  .replace(/<script type="module" src="[^"]+"><\/script>/, '<script type="module" src="__APP__"></script>')
  .replace(/<span class="version">[^<]+<\/span>/, '<span class="version">__VERSION__</span>');
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const id = createHash('sha256').update(JSON.stringify([PIPELINE_VERSION, version, license, template, ...sources, css])).digest('hex').slice(0, 16);
const courseIndex = modules.indexOf('course');
const courseId = createHash('sha256').update(sources[courseIndex]).digest('hex').slice(0, 16);
const assetId = name => name === 'course' ? courseId : id;
const directory = new URL('build/', root);
// Published asset URLs stay valid for cached HTML, even across several builds.
await mkdir(directory, { recursive: true });
for (let i = 0; i < modules.length; i++) {
  const source = modules[i] === 'course' ? sources[i] : licenseHeader + sources[i].replaceAll('__BUILD_ID__', id)
    .replace(/from '(\.\/)([a-z0-9_/-]+)\.js'/g, (_, path, name) => `from '${path}${name}.${assetId(name)}.js'`)
    .replace(/import\('(\.\/)([a-z0-9_/-]+)\.js'\)/g, (_, path, name) => `import('${path}${name}.${assetId(name)}.js')`)
    .replace(/new URL\('(\.\/)([a-z0-9_/-]+)\.js', import.meta.url\)/g, (_, path, name) => `new URL('${path}${name}.${assetId(name)}.js', import.meta.url)`);
  if(modules[i].includes('/')) await mkdir(new URL(`${modules[i].split('/')[0]}/`,directory),{recursive:true});
  await writeFile(new URL(`${modules[i]}.${assetId(modules[i])}.js`, directory), source);
}
await writeFile(new URL(`style.${id}.css`, directory), licenseHeader + css);
await mkdir(new URL('licenses/', root), { recursive: true });
await writeFile(new URL('licenses/Boost-1.0.txt', root), license);
const html = template.replace('__STYLE__', `./build/style.${id}.css`)
  .replace('__APP__', `./build/app.${id}.js`).replace('__VERSION__', `v${version}`);
await writeFile(htmlPath, html);
await writeFile(new URL('version.json', root), JSON.stringify({ id, version }) + '\n');
// Toolchains have their own fixed versions and are never duplicated per build.
// Published copies are checked in; vendoring is only needed to replace a runtime.
const vendor = new URL('../runtime-assets/', root);
if(await stat(vendor).then(()=>true,()=>false)) await cp(vendor,new URL('runtime-assets/v1/',root),{recursive:true});
console.log(`Built Code Typer Idle ${version} (${id})`);
