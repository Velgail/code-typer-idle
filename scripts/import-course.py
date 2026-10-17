"""Import pinned MIT reference implementations; never execute upstream scripts.
Requires tree-sitter-language-pack==1.22.1 for development only.
Download the pinned archives under work/tracks before running this importer.
"""
import json, pathlib, hashlib, sqlite3, re, sys, urllib.request, tarfile
from tree_sitter_language_pack import get_parser
ROOT=pathlib.Path(__file__).resolve().parent.parent
sources=json.loads((ROOT/'data/course-sources.json').read_text())
if '--download' in sys.argv:
 for source in sources:
  destination=ROOT/source['root']
  if destination.exists():continue
  destination.parent.mkdir(parents=True,exist_ok=True)
  archive=destination.parent/(source['track']+'.tar.gz')
  urllib.request.urlretrieve(f"https://codeload.github.com/exercism/{source['track']}/tar.gz/{source['sha']}",archive)
  with tarfile.open(archive) as bundle:bundle.extractall(destination.parent,filter='data')
EXT={'.cpp':'cpp','.h':'cpp','.cs':'csharp','.rs':'rust','.go':'go','.py':'python','.java':'java','.lua':'lua','.sql':'sql'}
FUNCTIONS={'function_definition','function_item','function_declaration','method_declaration','constructor_declaration'}
course={}; comments={};licenses=[]
translations=json.loads((ROOT/'data/course-comments-ja.json').read_text()) if (ROOT/'data/course-comments-ja.json').exists() else {}
for source in sources:
 track=source['track'];lang='sql' if track=='sqlite' else track
 root=ROOT/source['root']; config=json.loads((root/'config.json').read_text()); license=(root/'LICENSE').read_text();licenses.append(f'Exercism/{track} @ {source["sha"]}\nhttps://github.com/exercism/{track}\n\n{license}')
 entries=[]; learned=set();pending=list(config['exercises'].get('concept',[]))
 while pending:
  available=[e for e in pending if set(e.get('prerequisites',[]))<=learned]
  if not available:available=[min(pending,key=lambda e:len(set(e.get('prerequisites',[]))-learned))]
  entry=available[0];pending.remove(entry);entries.append(('concept',entry));learned.update(entry.get('concepts',[]))
 entries.extend(('practice',e) for e in sorted(config['exercises'].get('practice',[]),key=lambda e:e.get('difficulty',1)))
 exercises=[];files=[];units=[];parser=None if lang=='sql' else get_parser(lang)
 for kind,entry in entries:
  if entry.get('status','active') in ['deprecated','foregone','removed']:continue
  folder=root/'exercises'/kind/entry['slug'];meta=folder/'.meta/config.json'
  if not meta.exists():continue
  info=json.loads(meta.read_text());fileinfo=info.get('files',{}); examples=fileinfo.get('exemplar',fileinfo.get('example',[]));exercise_files=[];exercise_units=[]
  concepts=entry.get('concepts',entry.get('practices',[]));text=' '.join(concepts+[entry['slug']]).lower()
  subject='systems' if re.search('concurr|channel|thread|atomic|mutex|memory|parallel|semaphore|resource|circular-buffer',text) else 'design' if re.search('class|inherit|interface|object|generic|trait|enum|closure|delegate|encapsul|metatable|composition|linked-list|binary-search-tree',text) else 'graphics' if re.search('drawing|pixel|rectangle|darts|triangle|coordinate|robot-simulator|raster|spiral|render',text) else 'syntax'
  for filename in examples:
   path=folder/filename
   if not path.exists() or path.suffix not in EXT:continue
   raw=path.read_bytes();code=raw.decode('utf8').replace('\r\n','\n');raw=code.encode()
   fid=len(files);file_record={'path':filename,'code':code,'url':f'https://github.com/exercism/{track}/blob/{source["sha"]}/exercises/{kind}/{entry["slug"]}/{filename}'};file_comments=[];nodes=[]
   if parser:
    tree=parser.parse(raw);stack=[tree.root_node]
    while stack:
     n=stack.pop();stack.extend(reversed(n.children))
     if n.type in FUNCTIONS:nodes.append(n)
     is_doc = lang=='python' and n.type=='string' and n.parent and n.parent.type in ('block','module') and next((c for c in n.parent.named_children if c.type!='comment'),None)==n
     if is_doc or 'comment' in n.type and (not n.parent or 'comment' not in n.parent.type):file_comments.append((n.start_byte,n.end_byte,raw[n.start_byte:n.end_byte].decode()))
    for node in nodes:
     start,end=node.start_byte,node.end_byte;snippet=raw[start:end].decode();line_start=code.rfind('\n',0,len(raw[:start].decode()))+1
     name=node.child_by_field_name('name');label=raw[name.start_byte:name.end_byte].decode() if name else snippet.splitlines()[0][:90]
     own=[];ranges=[]
     for a,z,c in file_comments:
      if start<=a and z<=end:
       key=hashlib.sha256(c.encode()).hexdigest()[:16];comments[key]=c;own.append(key);ranges.append((key,len(raw[start:a].decode()),len(raw[start:z].decode())))
     uid=f'{lang}/{entry["uuid"]}/{hashlib.sha256((filename+str(start)+hashlib.sha256(raw).hexdigest()).encode()).hexdigest()[:16]}'
     exercise_units.append(len(units));units.append({'id':uid,'exercise':len(exercises),'file':fid,'label':label,'line':node.start_point[0]+1,'code':snippet,'comments':own,'ranges':ranges,'subject':subject})
   else:
    # SQLite's statement recognizer respects quoted strings and CREATE TRIGGER.
    buffer='';start_line=1
    for lineno,line in enumerate(code.splitlines(True),1):
     buffer+=line
     if sqlite3.complete_statement(buffer):
      uid=f'{lang}/{entry["uuid"]}/{hashlib.sha256((filename+str(start_line)+hashlib.sha256(raw).hexdigest()).encode()).hexdigest()[:16]}'
      own=[]
      for c in re.findall(r'--[^\n]*|/\*[\s\S]*?\*/',buffer):
       key=hashlib.sha256(c.encode()).hexdigest()[:16];comments[key]=c;own.append(key)
      exercise_units.append(len(units));units.append({'id':uid,'exercise':len(exercises),'file':fid,'label':f'SQL {start_line}–{lineno}','line':start_line,'code':buffer.strip(),'comments':own,'subject':subject})
      buffer='';start_line=lineno+1
   exercise_files.append(fid);files.append(file_record)
  if not exercise_units:
   # Constant-only implementations still teach declarations and SQL schemas.
   for fid in exercise_files:
    code=files[fid]['code'].strip()
    if not code:continue
    exercise_units.append(len(units));units.append({'id':f'{lang}/{entry["uuid"]}/'+hashlib.sha256((files[fid]['path']+code).encode()).hexdigest()[:16],'exercise':len(exercises),'file':fid,'label':files[fid]['path'],'line':1,'code':code,'comments':[],'subject':subject})
  if exercise_files:
   intro=folder/'.docs/instructions.md'
   exercises.append({'id':entry['uuid'],'slug':entry['slug'],'title':entry.get('name',entry['slug']),'kind':kind,'concepts':concepts,'prerequisites':entry.get('prerequisites',[]),'difficulty':entry.get('difficulty',1),'authors':info.get('authors',[]),'description':info.get('blurb',''),'instructions':intro.read_text() if intro.exists() else '', 'files':exercise_files,'units':exercise_units,'subject':subject})
  else:
   # No unit indexes have been emitted when no implementation file exists.
   pass
 blocks=[]
 for unit in units:
  pieces=[];buffer='';position=0
  for line in unit['code'].splitlines(True):
   # Keep long block comments intact; the full file remains available alongside.
   if buffer and len(buffer)+len(line)>360 and buffer.count('/*')==buffer.count('*/') and not any(a<position+len(buffer)<z for _,a,z in unit.get('ranges',[])):
    pieces.append((buffer.rstrip('\n'),position,position+len(buffer)));position+=len(buffer);buffer=''
   buffer+=line
  if buffer:pieces.append((buffer.rstrip('\n'),position,position+len(buffer)))
  for part,(code,start,end) in enumerate(pieces):
   keys=[key for key,_,offset in unit.get('ranges',[]) if start<offset<=end] if 'ranges' in unit else [key for key in unit['comments'] if re.sub(r'\s+',' ',comments[key]) in re.sub(r'\s+',' ',code)]
   block={**unit,'id':unit['id'].rsplit('/',1)[0]+'/'+hashlib.sha256((unit['id']+code).encode()).hexdigest()[:16]+f'/{part}','code':code,'comments':keys,'part':part+1,'parts':len(pieces),'key':hashlib.sha256((unit['id']+code+f'/{part}').encode()).hexdigest()[:16]}
   block.pop('ranges',None);blocks.append(block)
 for e in exercises:e['units']=[]
 for i,unit in enumerate(blocks):exercises[unit['exercise']]['units'].append(i)
 for unit in blocks:
  unit['comments']=[{'en':comments[key],'ja':translations.get(key,'')} for key in unit['comments']]
 course[lang]={'sha':source['sha'],'track':track,'exercises':exercises,'files':files,'functionCount':len(units),'units':blocks}
 print(lang,len(exercises),'exercises',len(units),'functions/statements',len(blocks),'blocks')
(ROOT/'src/course.js').write_text('// MIT reference implementations. See docs/licenses/exercism-MIT.txt and data/course-sources.json.\nexport const COURSE = '+json.dumps(course,ensure_ascii=False,separators=(',',':'))+';\n')
(ROOT/'work/tracks/course-comments.json').write_text(json.dumps(comments,ensure_ascii=False,indent=2))
(ROOT/'docs/licenses/exercism-MIT.txt').write_text('\n\n'.join(licenses))
