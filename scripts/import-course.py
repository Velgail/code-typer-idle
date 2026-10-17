"""Import pinned MIT reference implementations; never execute upstream scripts.
Requires tree-sitter-language-pack==1.22.1 for development only.
Download the pinned archives under work/tracks before running this importer.
"""
import json, pathlib, hashlib, sqlite3, re, sys, urllib.request, tarfile
from tree_sitter_language_pack import get_parser
from course_metadata import teaching_nodes, metadata, bindings, ancestors, FUNCTIONS, walk
ROOT=pathlib.Path(__file__).resolve().parent.parent
# The eight pinned track licenses were audited against Exercism's Community
# Content terms. A changed license must be reviewed before importing new data.
MIT_LICENSE_SHA256='e52f804e74f0fbd34e8927962319df346166b8194094309a0aee318693df44df'
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
course={}; comments={};licenses=[]
purposes=json.loads((ROOT/'data/course-purpose-ja.json').read_text())
previous_source=(ROOT/'docs/build/course.a422c81794d07a40.js').read_text()
previous=json.loads(previous_source.split('export const COURSE = ',1)[1].rsplit(';',1)[0])
def sql_comments(code):
 """Return comment spans, skipping SQLite strings and quoted identifiers."""
 i=0
 while i<len(code):
  if code[i] in "'\"`[":
   close=']' if code[i]=='[' else code[i];i+=1
   while i<len(code):
    if code[i]==close:
     i+=1
     if i<len(code) and code[i]==close:i+=1;continue
     break
    i+=1
  elif code.startswith('--',i) or code.startswith('/*',i):
   end=code.find('\n',i) if code.startswith('--',i) else code.find('*/',i+2)
   end=len(code) if end<0 else end if code.startswith('--',i) else end+2
   yield i,end,code[i:end];i=end
  else:i+=1
translations=json.loads((ROOT/'data/course-comments-ja.json').read_text()) if (ROOT/'data/course-comments-ja.json').exists() else {}
context_translations=ROOT/'data/course-context-comments-ja.json'
if context_translations.exists():translations.update(json.loads(context_translations.read_text()))
def sql_fingerprint(code):
 for a,z,_ in reversed(list(sql_comments(code))):code=code[:a]+' '+code[z:]
 return tuple(re.findall(r"'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|`(?:``|[^`])*`|\[[^]]+\]|\w+|[^\w\s]",code))
for source in sources:
 track=source['track'];lang='sql' if track=='sqlite' else track
 root=ROOT/source['root']; config=json.loads((root/'config.json').read_text()); license_bytes=(root/'LICENSE').read_bytes()
 if hashlib.sha256(license_bytes).hexdigest()!=MIT_LICENSE_SHA256:raise RuntimeError(f'Unreviewed license: Exercism/{track}; stop before importing')
 license=license_bytes.decode('utf8');licenses.append(f'Exercism/{track} @ {source["sha"]}\nhttps://github.com/exercism/{track}\n\n{license}')
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
  starters=[];starter_statements=set();setup=[]
  for starter_name in fileinfo.get('solution',[]):
   starter_path=folder/starter_name
   if not starter_path.exists() or starter_path.suffix not in EXT:continue
   starter_code=starter_path.read_text().replace('\r\n','\n');starter_raw=starter_code.encode()
   setup.append({'path':starter_name,'code':starter_code})
   if parser:starters.append((parser.parse(starter_raw),starter_raw))
   else:
    buffer=''
    for line in starter_code.splitlines(True):
     if line.lstrip().startswith('.'):continue
     buffer+=line
     if sqlite3.complete_statement(buffer):starter_statements.add(sql_fingerprint(buffer));buffer=''
  if lang=='sql' and (folder/'create_fixture.sql').exists():
   setup.insert(0,{'path':'create_fixture.sql','code':(folder/'create_fixture.sql').read_text().replace('\r\n','\n')})
  for filename in examples:
   path=folder/filename
   if not path.exists() or path.suffix not in EXT:continue
   original_code=path.read_text().replace('\r\n','\n');code=re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]','',original_code);raw=code.encode()
   fid=len(files);file_record={'path':filename,'code':original_code,'url':f'https://github.com/exercism/{track}/blob/{source["sha"]}/exercises/{kind}/{entry["slug"]}/{filename}'};file_comments=[];nodes=[]
   if parser:
    tree=parser.parse(raw);stack=[tree.root_node]
    while stack:
     n=stack.pop();stack.extend(reversed(n.children))
     is_doc = lang=='python' and n.type=='string' and n.parent and n.parent.type in ('block','module') and next((c for c in n.parent.named_children if c.type!='comment'),None)==n
     if is_doc or 'comment' in n.type and (not n.parent or 'comment' not in n.parent.type):
      text=raw[n.start_byte:n.end_byte].decode()
      if not re.fullmatch(r'[\s/*!#-]+',text):file_comments.append((n.start_byte,n.end_byte,text))
    for node,start,end in teaching_nodes(tree,raw,starters):
     snippet=raw[start:end].decode();info=metadata(node,raw,lang);label=info['qualifiedName']
     members=[];symbols=[]
     for member in walk(tree.root_node):
      if member.type not in FUNCTIONS or not (start<=member.start_byte and member.end_byte<=end):continue
      if any(p.type in FUNCTIONS and start<=p.start_byte and p.end_byte<=end for p in ancestors(member)):continue
      member_info=metadata(member,raw,lang)
      members.append({'name':member_info['name'],'qualifiedName':member_info['qualifiedName'],'line':member.start_point[0]+1,'endLine':member.end_point[0]+1})
      symbols.extend({**b,'owner':member_info['qualifiedName']} for b in member_info['bindings'])
     symbols.extend(b for b in bindings(tree.root_node,raw,lang) if raw[:start].count(b'\n')+1<=b['line']<=raw[:end].count(b'\n')+1)
     info['members']=members;info['bindings']=list({(b['name'],b.get('owner',''),b['line']):b for b in symbols}.values())
     if len(members)>1 and node.type in FUNCTIONS:label=' / '.join(m['qualifiedName'] for m in members)
     own=[];ranges=[]
     for a,z,c in file_comments:
      if start<=a and z<=end:
       key=hashlib.sha256(c.encode()).hexdigest()[:16];comments[key]=c;own.append(key);ranges.append((key,len(raw[start:a].decode()),len(raw[start:z].decode())-len(c)+len(c.rstrip('\r\n'))))
     uid=f'{lang}/{entry["uuid"]}/{hashlib.sha256((filename+str(start)+hashlib.sha256(raw).hexdigest()).encode()).hexdigest()[:16]}'
     exercise_units.append(len(units));units.append({'id':uid,'exercise':len(exercises),'file':fid,'label':label,'line':raw[:start].count(b'\n')+1,'code':snippet,'comments':own,'ranges':ranges,'prefixLength':len(raw[start:node.start_byte].decode()),'subject':subject,**info})
   else:
    # SQLite's statement recognizer respects quoted strings and CREATE TRIGGER.
    buffer='';start_line=1
    for lineno,line in enumerate(code.splitlines(True),1):
     if line.lstrip().startswith('.'):
      if not buffer.strip():start_line=lineno+1
      continue
     buffer+=line
     if sqlite3.complete_statement(buffer):
      if sql_fingerprint(buffer) in starter_statements:buffer='';start_line=lineno+1;continue
      uid=f'{lang}/{entry["uuid"]}/{hashlib.sha256((filename+str(start_line)+hashlib.sha256(raw).hexdigest()).encode()).hexdigest()[:16]}'
      own=[];ranges=[];leading=len(buffer)-len(buffer.lstrip())
      for a,z,c in sql_comments(buffer):
       if re.fullmatch(r'[\s/*#-]+',c):continue
       key=hashlib.sha256(c.encode()).hexdigest()[:16];comments[key]=c;own.append(key);ranges.append((key,a-leading,z-leading))
      exercise_units.append(len(units));units.append({'id':uid,'exercise':len(exercises),'file':fid,'label':f'SQL {start_line}–{lineno}','line':start_line,'code':buffer.strip(),'comments':own,'ranges':ranges,'subject':subject})
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
   meta_info=json.loads(meta.read_text())
   exercises.append({'id':entry['uuid'],'slug':entry['slug'],'title':entry.get('name',entry['slug']),'kind':kind,'concepts':concepts,'prerequisites':entry.get('prerequisites',[]),'difficulty':entry.get('difficulty',1),'authors':meta_info.get('authors',[]),'description':meta_info.get('blurb',''),'purposeJa':purposes.get(f'{lang}/{entry["slug"]}',purposes[entry['slug']]),'setup':setup,'instructions':intro.read_text() if intro.exists() else '', 'files':exercise_files,'units':exercise_units,'subject':subject})
  else:
   # No unit indexes have been emitted when no implementation file exists.
   pass
 blocks=[]
 for unit in units:
  pieces=[];buffer='';position=0
  for line in unit['code'].splitlines(True):
   # Keep long block comments intact; the full file remains available alongside.
   if buffer and len(buffer)+len(line)>680 and position+len(buffer)>unit.get('prefixLength',0) and buffer.count('/*')==buffer.count('*/') and not re.search(r'(?:^|\n)\s*(?://[/!]|#\[|@)[^\n]*\n?\s*$',buffer) and not any(a<position+len(buffer)<z for _,a,z in unit.get('ranges',[])):
    pieces.append((buffer.rstrip('\n'),position,position+len(buffer)));position+=len(buffer);buffer=''
   buffer+=line
  if buffer:pieces.append((buffer.rstrip('\n'),position,position+len(buffer)))
  for part,(code,start,end) in enumerate(pieces):
   spans=[]
   for key,a,z in unit.get('ranges',[]):
    if start<=a and z<=start+len(code):
     assert code[a-start:z-start]==comments[key].rstrip('\r\n'),unit['id']
     # JavaScript cursors count UTF-16 code units, not Python code points.
     spans.append({'en':comments[key].rstrip('\r\n'),'ja':translations.get(key,''),'start':len(code[:a-start].encode('utf-16-le'))//2,'end':len(code[:z-start].encode('utf-16-le'))//2})
   block={**unit,'id':unit['id'].rsplit('/',1)[0]+'/'+hashlib.sha256((unit['id']+code).encode()).hexdigest()[:16]+f'/{part}','code':code,'comments':spans,'line':unit['line']+unit['code'][:start].count('\n'),'part':part+1,'parts':len(pieces),'key':hashlib.sha256((unit['id']+code+f'/{part}').encode()).hexdigest()[:16]}
   block.pop('ranges',None);block.pop('prefixLength',None);blocks.append(block)
 for e in exercises:e['units']=[]
 for i,unit in enumerate(blocks):exercises[unit['exercise']]['units'].append(i)
 legacy_targets={}
 for old in previous[lang]['units']:
  if any(u['id']==old['id'] for u in blocks):continue
  old_exercise=previous[lang]['exercises'][old['exercise']]['id']
  candidates=[u for u in blocks if exercises[u['exercise']]['id']==old_exercise]
  if candidates:legacy_targets[old['id']]=next((u['id'] for u in candidates if u['line']>=old['line']),candidates[-1]['id'])
 course[lang]={'sha':source['sha'],'track':track,'exercises':exercises,'files':files,'functionCount':sum(1 for f in files for n in walk(parser.parse(f['code'].encode()).root_node) if n.type in FUNCTIONS) if parser else len(units),'units':blocks,'legacyTargets':legacy_targets}
 print(lang,len(exercises),'exercises',len(units),'declaration groups',len(blocks),'blocks')
notices='Exercism source code, exercise text, and excerpts: MIT.\nProject-authored Japanese translations and metadata transformations: Boost Software License 1.0.\nSources and pinned commits: data/course-sources.json\n\n'+'\n\n'.join(licenses)+'\n\n'+(ROOT/'LICENSE').read_text()
# Keep the full notices in the independently downloadable browser module too.
header='/*\n'+notices.replace('*/','* /')+'\n*/\n'
(ROOT/'src/course.js').write_text(header+'export const COURSE = '+json.dumps(course,ensure_ascii=False,separators=(',',':'))+';\n')
(ROOT/'work/tracks/course-comments.json').write_text(json.dumps(comments,ensure_ascii=False,indent=2))
(ROOT/'docs/licenses/exercism-MIT.txt').write_text('\n\n'.join(licenses))
