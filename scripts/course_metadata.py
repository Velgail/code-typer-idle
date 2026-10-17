"""Keep lexical context and declared bindings when importing reference code."""

FUNCTIONS = {'function_definition', 'function_item', 'function_declaration', 'method_declaration', 'constructor_declaration'}
SCOPES = {
 'namespace_definition': 'namespace', 'namespace_declaration': 'namespace',
 'class_specifier': 'class', 'struct_specifier': 'struct',
 'class_declaration': 'class', 'struct_declaration': 'struct',
 'class_definition': 'class', 'enum_declaration': 'enum', 'enum_item': 'enum',
 'interface_declaration': 'interface', 'impl_item': 'impl',
 'trait_item': 'trait', 'mod_item': 'module',
}
SUPPORT = {'import_declaration','package_clause','package_declaration','import_statement','import_from_statement','use_declaration','using_directive','using_declaration','preproc_include','attribute_item','inner_attribute_item'}

def source(node, raw):
 return raw[node.start_byte:node.end_byte].decode() if node else ''

def walk(node):
 yield node
 for child in node.children:
  yield from walk(child)

def scope(node, raw):
 result=[];parent=node.parent
 while parent:
  if parent.type in SCOPES:
   name=parent.child_by_field_name('name') or parent.child_by_field_name('type')
   if name:
    label=source(name,raw)
    if parent.type=='impl_item' and parent.child_by_field_name('trait'):label=source(parent.child_by_field_name('trait'),raw)+' for '+label
    result.append({'kind':SCOPES[parent.type], 'name':label, 'line':parent.start_point[0]+1})
  parent=parent.parent
 result=list(reversed(result))
 receiver=node.child_by_field_name('receiver')
 if receiver:
  parameter=next((c for c in receiver.named_children if c.type=='parameter_declaration'),None)
  if parameter and parameter.child_by_field_name('type'):result.append({'kind':'receiver','name':source(parameter.child_by_field_name('type'),raw),'line':node.start_point[0]+1})
 return result

def function_name(node, raw):
 name=node.child_by_field_name('name')
 if name:return source(name,raw)
 if node.type=='impl_item':
  type_name=source(node.child_by_field_name('type'),raw);trait=source(node.child_by_field_name('trait'),raw)
  return f'{trait} for {type_name}' if trait else type_name
 if node.type=='function_definition' and source(node,raw).startswith('function('):
  parts=[]
  for parent in ancestors(node):
   if parent.type=='field':
    name=parent.child_by_field_name('name') or parent.child_by_field_name('key')
    if name:parts.insert(0,source(name,raw).strip('"\''))
   if parent.type=='assignment_statement':
    names=parent.child_by_field_name('left') or next((c for c in parent.named_children if c.type=='variable_list'),None)
    if names:parts.insert(0,source(names,raw));break
  if parts:return '.'.join(parts)
 declarator=node.child_by_field_name('declarator')
 while declarator:
  child=declarator.child_by_field_name('declarator')
  if not child:return source(declarator,raw)
  declarator=child
 return source(node,raw).splitlines()[0]

def fingerprint(node, raw, comments=False):
 # Compare real tokens: whitespace inside a string literal must remain distinct.
 def tokens(current):
  if 'comment' in current.type and not comments:return ()
  if not current.children:return (source(current,raw),)
  return tuple(token for child in current.children for token in tokens(child))
 return (tuple((s['kind'],s['name']) for s in scope(node,raw)),tokens(node))

def teaching_nodes(tree, raw, starter_trees):
 """Use complete top-level declarations, not anonymous or nested functions.

 Keep changed comments with the declaration they explain. Existing declarations
 are reading context, not an extra sequence of implementation exercises.
 """
 existing=set();existing_with_comments=set();existing_comments=set()
 for starter,starter_raw in starter_trees:
  for node in starter.root_node.named_children:
   if 'comment' in node.type:existing_comments.add(source(node,starter_raw));continue
   existing.add(fingerprint(node,starter_raw));existing_with_comments.add(fingerprint(node,starter_raw,True))
 selected=[];pending=[]
 for node in tree.root_node.named_children:
  if 'comment' in node.type:
   pending.append(node);continue
  attached=[];edge=node.start_byte
  for comment in reversed(pending):
   if raw[comment.end_byte:edge].count(b'\n')>1:break
   attached.insert(0,comment);edge=comment.start_byte
  attached=[c for c in attached if source(c,raw) not in existing_comments];pending=[]
  if fingerprint(node,raw,True) not in existing_with_comments or attached:
   start=attached[0].start_byte if attached else node.start_byte
   selected.append((node,start,node.end_byte))
 # A completed introductory example can still be a useful first exercise.
 if not selected:
  selected=[(n,n.start_byte,n.end_byte) for n in tree.root_node.named_children if n.type in FUNCTIONS or n.type in SCOPES]
 # Imports and attributes support an implementation; they are not a separate
 # exercise. In Rust, an attribute is a sibling of the declaration it decorates.
 attached=[];prefix=None
 for node,start,end in selected:
  if node.type in SUPPORT:
   prefix=start if prefix is None else prefix
   continue
  attached.append((node,prefix if prefix is not None else start,end));prefix=None
 if prefix is not None and attached:
  node,start,end=attached[-1];attached[-1]=(node,start,selected[-1][2])
 grouped=[]
 for node,start,end in attached:
  if grouped and grouped[-1][2]-grouped[-1][1]<180 and not raw[grouped[-1][2]:start].strip():
   before=grouped.pop();grouped.append((node,before[1],end))
  else:grouped.append((node,start,end))
 return grouped

def declared_names(node, raw):
 if not node:return []
 if node.type in ('identifier','field_identifier'):return [source(node,raw)]
 if node.type in ('attribute','field_expression','selector_expression','subscript','subscript_expression','index_expression','dot_index_expression'):return []
 name=node.child_by_field_name('name') or node.child_by_field_name('declarator') or node.child_by_field_name('pattern')
 if name:return declared_names(name,raw)
 return [name for child in node.named_children for name in declared_names(child,raw) if child.type not in ('type_identifier','primitive_type','string','integer','number_literal','type_annotation')]

def bindings(node, raw, language):
 result={}
 def add(names, kind, declaration, type_node=None, value=None):
  for name in names:
   if not name or name=='_':continue
   record={'name':name,'kind':kind,'line':declaration.start_point[0]+1}
   if type_node:record['type']=source(type_node,raw)
   if value:record['initial']=source(value,raw)[:180]
   if name not in result or kind=='parameter':result[name]=record
   elif result[name]['kind']!='parameter':result[name].update(record)
 parameters=node.child_by_field_name('parameters')
 if not parameters:
  declarator=node.child_by_field_name('declarator')
  if declarator:parameters=next((n for n in walk(declarator) if n.type=='parameter_list'),None)
 if parameters:
  for parameter in parameters.named_children:
   name=parameter.child_by_field_name('name') or parameter.child_by_field_name('declarator') or parameter.child_by_field_name('pattern')
   if parameter.type=='identifier':name=parameter
   if parameter.type in ('typed_parameter','list_splat_pattern','dictionary_splat_pattern'):name=parameter.named_children[0] if parameter.named_children else None
   names=declared_names(name,raw)
   # Go allows several parameter names to share one type.
   if language=='go':names=[source(n,raw) for n in parameter.children_by_field_name('name')]
   add(names,'parameter',parameter,parameter.child_by_field_name('type'),parameter.child_by_field_name('value'))
 receiver=node.child_by_field_name('receiver')
 if receiver:
  for parameter in receiver.named_children:
   add([source(n,raw) for n in parameter.children_by_field_name('name')],'receiver',parameter,parameter.child_by_field_name('type'))
 body=node.child_by_field_name('body') or node
 stack=list(reversed(body.named_children))
 while stack:
  current=stack.pop()
  if current.type in FUNCTIONS:continue
  stack.extend(reversed(current.named_children))
  name=None;kind='local';type_node=None;value=None
  if current.type in ('variable_declarator','init_declarator','declaration'):
   name=current.child_by_field_name('name') or current.child_by_field_name('declarator');value=current.child_by_field_name('value')
   if current.parent:type_node=current.parent.child_by_field_name('type')
  elif current.type=='let_declaration':
   name=current.child_by_field_name('pattern');type_node=current.child_by_field_name('type');value=current.child_by_field_name('value')
  elif current.type in ('short_var_declaration','assignment','assignment_statement','var_spec','variable_declaration'):
   name=current.child_by_field_name('left') or current.child_by_field_name('name');value=current.child_by_field_name('right') or current.child_by_field_name('value');type_node=current.child_by_field_name('type')
   if language=='lua' and not name:name=next((c for c in current.named_children if c.type=='variable_list'),None)
   if language=='lua' and not value:value=next((c for c in current.named_children if c.type=='expression_list'),None)
  elif current.type in ('for_statement','for_in_clause','range_clause','enhanced_for_statement'):
   name=current.child_by_field_name('left') or current.child_by_field_name('name') or current.child_by_field_name('pattern');kind='iteration'
  if name:add(declared_names(name,raw),kind,current,type_node,value)
 # Do not list unrelated type names or helper calls as variables.
 return list(result.values())

def metadata(node, raw, language):
 owners=scope(node,raw);name=function_name(node,raw)
 separator='.' if language in ('java','csharp','python','lua','go') else '::'
 qualified=separator.join([s['name'] for s in owners]+[name])
 if node.type in SCOPES:owners=owners+[{'kind':SCOPES[node.type],'name':name,'line':node.start_point[0]+1}]
 members=[];symbols=bindings(node,raw,language)
 if node.type not in FUNCTIONS:
  for child in walk(node):
   if child==node or child.type not in FUNCTIONS:continue
   if any(parent.type in FUNCTIONS for parent in ancestors(child) if parent!=node):continue
   info=metadata(child,raw,language);members.append({'name':info['name'],'qualifiedName':info['qualifiedName'],'line':child.start_point[0]+1})
   symbols.extend({**b,'owner':info['qualifiedName']} for b in info['bindings'])
 return {'name':name,'qualifiedName':qualified,'scope':owners,'bindings':symbols,'members':members}

def ancestors(node):
 parent=node.parent
 while parent:
  yield parent;parent=parent.parent
