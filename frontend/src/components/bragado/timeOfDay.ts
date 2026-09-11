import { useSyncExternalStore } from 'react';
import * as T from 'three';

export type EnvironmentMode = 'actual' | 'day' | 'sunset' | 'night';
export const ENVIRONMENT_MODES: Record<EnvironmentMode,string> = {actual:'Actual',day:'Día',sunset:'Atardecer',night:'Noche'};
const key='aeroinspect.environment';
const valid=(value:string|null):value is EnvironmentMode=>value!==null&&Object.prototype.hasOwnProperty.call(ENVIRONMENT_MODES,value);
function read():EnvironmentMode {try{const value=localStorage.getItem(key);return valid(value)?value:'actual';}catch{return 'actual';}}
let mode=read();
const listeners=new Set<()=>void>();
function storage(event:StorageEvent){if(event.key===key||event.key===null){mode=read();listeners.forEach(fn=>fn());}}
export function subscribeEnvironment(fn:()=>void){if(!listeners.size)window.addEventListener('storage',storage);listeners.add(fn);return()=>{listeners.delete(fn);if(!listeners.size)window.removeEventListener('storage',storage);};}
export const getEnvironmentMode=()=>mode;
export function setEnvironmentMode(value:EnvironmentMode){mode=value;try{localStorage.setItem(key,value);}catch{/* In-memory preference remains available. */}listeners.forEach(fn=>fn());}
export function useEnvironmentMode(){return useSyncExternalStore(subscribeEnvironment,getEnvironmentMode);}

export type EnvironmentParameters={sun:number;ambient:number;exposure:number;artificial:number;stars:number;moon:number;sunColor:T.Color;ambientColor:T.Color;top:T.Color;horizon:T.Color;sunPosition:T.Vector3};
const color=(hex:string)=>new T.Color(hex);
const day:EnvironmentParameters={sun:2.7,ambient:1.65,exposure:1,artificial:0,stars:0,moon:0,sunColor:color('#fff7ed'),ambientColor:color('#dcecff'),top:color('#478dcc'),horizon:color('#c3e3f2'),sunPosition:new T.Vector3(-65,110,40)};
const dusk:EnvironmentParameters={sun:2,ambient:1.35,exposure:1.15,artificial:.5,stars:.06,moon:.15,sunColor:color('#ffd0a0'),ambientColor:color('#c9d0e5'),top:color('#778fbc'),horizon:color('#efb991'),sunPosition:new T.Vector3(-115,24,25)};
const night:EnvironmentParameters={sun:.55,ambient:.65,exposure:1.1,artificial:1,stars:1,moon:1,sunColor:color('#99b8ed'),ambientColor:color('#708fc3'),top:color('#07142c'),horizon:color('#233857'),sunPosition:new T.Vector3(-85,120,-95)};
export function blendEnvironment(a:EnvironmentParameters,b:EnvironmentParameters,t:number):EnvironmentParameters {
  const lerp=(x:number,y:number)=>T.MathUtils.lerp(x,y,t);
  return {sun:lerp(a.sun,b.sun),ambient:lerp(a.ambient,b.ambient),exposure:lerp(a.exposure,b.exposure),artificial:lerp(a.artificial,b.artificial),stars:lerp(a.stars,b.stars),moon:lerp(a.moon,b.moon),sunColor:a.sunColor.clone().lerp(b.sunColor,t),ambientColor:a.ambientColor.clone().lerp(b.ambientColor,t),top:a.top.clone().lerp(b.top,t),horizon:a.horizon.clone().lerp(b.horizon,t),sunPosition:a.sunPosition.clone().lerp(b.sunPosition,t)};
}
export function resolveEnvironment(selected:EnvironmentMode,date=new Date()):EnvironmentParameters {
  if(selected==='day')return blendEnvironment(day,day,0);
  if(selected==='sunset')return blendEnvironment(dusk,dusk,0);
  if(selected==='night')return blendEnvironment(night,night,0);
  const minutes=date.getHours()*60+date.getMinutes()+date.getSeconds()/60;
  if(minutes>=360&&minutes<420)return blendEnvironment(night,day,(minutes-360)/60);
  if(minutes>=420&&minutes<1140)return blendEnvironment(day,day,0);
  if(minutes>=1140&&minutes<1230){const t=(minutes-1140)/90;return t<.5?blendEnvironment(day,dusk,t*2):blendEnvironment(dusk,night,(t-.5)*2);}
  return blendEnvironment(night,night,0);
}
