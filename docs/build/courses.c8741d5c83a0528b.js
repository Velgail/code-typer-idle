// The large, pinned course archive loads only when a player opens a course.
let archive = null;
let lookup = new Map();
export function installCourses(data) {
  archive = data;
  lookup = new Map(Object.entries(data).flatMap(([language,track])=>track.units.map((unit,index)=>[unit.id,{...unit,index,language}])));
}
export const coursesLoaded = () => !!archive;
export const courseTrack = language => archive?.[language] || null;
export const courseUnit = id => lookup.get(id) || null;
export function firstCourseUnit(language,subject) { return courseTrack(language)?.units.find(u=>u.subject===subject) || null; }
export function currentCourseUnit(state) {
  if(!archive)return null;
  const t=state.typing, saved=courseUnit(t.courseUnit);
  if(saved?.language===t.language && saved.subject===state.subject)return saved;
  const remembered=courseUnit(t.courseCursors[`${t.language}/${state.subject}`]?.id);
  const unit=remembered || firstCourseUnit(t.language,state.subject);
  if(unit){t.courseUnit=unit.id;t.context='';t.offset=0;t.roundErrors=0;t.bonusBase=0;}
  else {t.courseUnit='';t.offset=0;t.bonusBase=0;}
  return unit;
}
export function rememberCourseCursor(state) {
  const t=state.typing,unit=courseUnit(t.courseUnit);
  if(t.source==='course' && t.context.startsWith('study/') && unit){
    t.courseCursors[`${unit.language}/${unit.subject}`]={id:unit.id,offset:t.offset,roundErrors:t.roundErrors,bonusBase:t.bonusBase};
  }
}
export function nextCourseUnit(unit) {
  const pool=courseTrack(unit.language).units.filter(u=>u.subject===unit.subject);
  return pool[(pool.findIndex(u=>u.id===unit.id)+1)%pool.length];
}
export function courseLesson(id) {
  const unit=courseUnit(id);if(!unit)return null;
  const track=courseTrack(unit.language),exercise=track.exercises[unit.exercise],file=track.files[unit.file];
  return {...unit,title:`${exercise.title} / ${unit.label} (${unit.part}/${unit.parts})`,exerciseInfo:exercise,fileInfo:file,comments:unit.comments};
}
export const validCourseId = id => typeof id==='string' && /^[a-z]+\/[a-f0-9-]{36}\/(?:[a-f0-9]{16}|file-\d+)\/\d+$/.test(id);
