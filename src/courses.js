// The large, pinned course archive loads only when a player opens a course.
let archive = null;
let lookup = new Map();
let legacyArchive = null;
export function installCourses(data) {
  archive = data;
  legacyArchive = null;
  lookup = new Map(Object.entries(data).flatMap(([language,track])=>track.units.map((unit,index)=>[unit.id,{...unit,index,language}])));
}
export function needsLegacyCourses(state) {
  const refs=[state.typing.courseUnit,state.typing.lastCompleted?.courseUnit,state.typing.lastCourseComments,...Object.values(state.typing.courseCursors).map(c=>c.id)];
  return refs.some(id=>id && !lookup.has(id) && archive?.[id.split('/')[0]]?.legacyTargets?.[id]);
}
export function installLegacyCourses(data) {
  legacyArchive=data;
  for(const [language,track] of Object.entries(data))for(const unit of track.units){
    const target=archive?.[language]?.legacyTargets?.[unit.id];
    if(target && !lookup.has(unit.id))lookup.set(unit.id,{...unit,language,legacy:true,next:target});
  }
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
  if(unit.legacy)return courseUnit(unit.next) || firstCourseUnit(unit.language,unit.subject);
  const pool=courseTrack(unit.language).units.filter(u=>u.subject===unit.subject);
  return pool[(pool.findIndex(u=>u.id===unit.id)+1)%pool.length];
}
export function courseLesson(id) {
  const unit=courseUnit(id);if(!unit)return null;
  const track=unit.legacy?legacyArchive[unit.language]:courseTrack(unit.language),oldExercise=track.exercises[unit.exercise],exercise=unit.legacy?courseTrack(unit.language).exercises.find(e=>e.id===oldExercise.id):oldExercise,file=track.files[unit.file];
  return {...unit,title:`${exercise.title} / ${unit.label} (${unit.part}/${unit.parts})`,exerciseInfo:exercise,fileInfo:file,comments:unit.comments};
}
export const validCourseId = id => typeof id==='string' && /^[a-z]+\/[a-f0-9-]{36}\/(?:[a-f0-9]{16}|file-\d+)\/\d+$/.test(id);
