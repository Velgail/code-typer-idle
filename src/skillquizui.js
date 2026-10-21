// Syntax practice keeps the answer control mounted while idle ticks continue.
import { renderHighlightedCode } from './codehighlight.js';
import { attachCodeEditor } from './codeeditor.js';

const mounted=new WeakMap();
const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;};
const write=(el,value)=>{if(el.textContent!==String(value??''))el.textContent=String(value??'');};
function mount(root){
  const heading=node('div','quiz-heading'),title=node('h3','skill-quiz-title'),position=node('span','quiz-position');heading.append(title,position);
  const meta=node('p','skill-quiz-meta panel-note');
  const picker=node('div','quiz-topic-picker'),label=node('label','','課題'),select=node('select','skill-quiz-topic');select.id='skill-quiz-topic';label.htmlFor=select.id;picker.append(label,select);
  const prompt=node('p','skill-quiz-prompt');
  const prerequisites=node('p','panel-note skill-quiz-prerequisites');
  const code=node('pre','reference-code skill-quiz-code');code.tabIndex=0;
  const answerLabel=node('label','quiz-editor-label','空欄に入るコード');answerLabel.htmlFor='skill-quiz-answer';
  const answer=node('textarea','skill-quiz-answer');answer.id='skill-quiz-answer';answer.rows=2;answer.maxLength=4096;answer.spellcheck=false;answer.autocomplete='off';answer.autocapitalize='off';answer.setAttribute('autocorrect','off');
  const keys=node('p','panel-note','空欄の部分だけ入力 · Tabで補完・字下げ · Shift + Tabで字上げ · Ctrl / ⌘ + Enterで回答');
  const actions=node('div','quiz-actions'),run=node('button','primary-button skill-quiz-submit','回答する'),next=node('button','secondary-button skill-quiz-next','次のQuizへ →');run.type=next.type='button';actions.append(run,next);
  const result=node('section','skill-quiz-result');result.setAttribute('role','status');result.setAttribute('aria-live','polite');
  const status=node('p','skill-quiz-status'),explanation=node('p','skill-quiz-explanation');result.append(status,explanation);
  const reward=node('section','quiz-rewards skill-quiz-rewards');reward.setAttribute('aria-label','Quizの成果');
  const rewardTitle=node('h4','quiz-rewards-title'),rewardItems=node('dl','quiz-rewards-items'),rewardNote=node('p','quiz-rewards-note');reward.append(rewardTitle,rewardItems,rewardNote);
  root.replaceChildren(heading,meta,picker,prompt,prerequisites,code,answerLabel,answer,keys,actions,result,reward);
  const editor=attachCodeEditor(answer,{language:'cpp',context:''});
  const ui={root,title,position,meta,select,prompt,prerequisites,code,answer,editor,run,next,result,status,explanation,rewardTitle,rewardItems,rewardNote,key:null,topicsKey:null,model:{}};
  answer.addEventListener('input',()=>ui.model.onDraft?.(answer.value));
  answer.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();if(!run.disabled)ui.model.onRun?.(answer.value);}event.stopPropagation();});
  run.addEventListener('click',()=>{if(!run.disabled)ui.model.onRun?.(answer.value);});
  next.addEventListener('click',()=>{if(!next.disabled)ui.model.onNext?.();});
  select.addEventListener('change',()=>ui.model.onSelect?.(Number(select.value)));
  mounted.set(root,ui);return ui;
}
export function renderSkillQuizUI(options){
  const ui=mounted.get(options.root)||mount(options.root),q=options.quiz;
  ui.model=options;
  const changed=ui.key!==q.id;ui.key=q.id;
  write(ui.title,q.title);write(ui.position,options.position);
  write(ui.meta,`Quiz · ${q.difficultyLabel} · 目安 ${q.estimatedMinutes}分 · ${q.concept}`);
  write(ui.prompt,q.prompt);
  write(ui.prerequisites,options.prerequisiteNames?.length?`先に触れておくと役立つもの：${options.prerequisiteNames.join('、')}`:'');ui.prerequisites.hidden=!options.prerequisiteNames?.length;
  const topicsKey=JSON.stringify(options.topics.map(t=>[t.id,t.completed]));
  if(changed||ui.topicsKey!==topicsKey){ui.topicsKey=topicsKey;ui.select.replaceChildren(...options.topics.map(t=>{const el=node('option','',`${t.completed?'✓ ':''}${t.difficultyLabel} · ${t.title}`);el.value=t.index;return el;}));}
  ui.select.value=String(q.index);
  const source=options.result?.passed?q.code.replace('____',options.draft):q.code.replace('____','⟦ 空欄 ⟧');renderHighlightedCode(ui.code,source,q.language);
  if(ui.answer.value!==options.draft)ui.answer.value=options.draft;
  ui.answer.disabled=ui.run.disabled=ui.select.disabled=!!options.disabled;
  // Completion only sees the problem's visible source, never its canonical
  // answer or explanation. The native control stays mounted across idle ticks.
  ui.editor.update({language:q.language,context:q.code});
  ui.next.disabled=!!options.disabled;ui.next.hidden=!options.completed && !options.result?.passed;
  ui.result.hidden=!options.result;
  ui.root.dataset.quizStatus=options.result?.status||'idle';
  write(ui.status,options.result?.passed?'正解。空欄の条件を満たしています。':options.result?.message||'');
  write(ui.explanation,options.result?.explanation||'');ui.result.classList.toggle('correct',!!options.result?.passed);
  const summary=options.rewardSummary||{};write(ui.rewardTitle,summary.title||'');write(ui.rewardNote,summary.note||'');
  ui.rewardItems.replaceChildren(...(summary.items||[]).flatMap(item=>[node('dt','',item.label),node('dd','',item.value)]));
}
