import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeActivityUpdates } from '../api/client';

export type ActivityItem={id:string;kind:string;name:string;plantId:string;occurredAt:string};
export type ActivityFeed={activity:ActivityItem[];notifications:ActivityItem[]};
export const activityTitles:Record<string,string>={ASSET_CREATED:'Registró un nuevo activo',MISSION_CREATED:'Creó una misión',MISSION_STARTED:'Inició una misión'};
export const noticeTitles:Record<string,string>={MISSION_STARTED:'Misión iniciada',MISSION_COMPLETED:'Misión finalizada',MISSION_CANCELLED:'Misión cancelada',MISSION_FAILED:'Misión fallida'};
export const eventDate=(value:string)=>new Date(value).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
type Context=ActivityFeed & {loading:boolean;error:string;unread:number;markRead:()=>void;dismiss:(id:string)=>void};
const ActivityContext=createContext<Context>({activity:[],notifications:[],loading:true,error:'',unread:0,markRead:()=>{},dismiss:()=>{}});
export const useActivity=()=>useContext(ActivityContext);
export function ActivityProvider({username,plantId,token,children}:{username:string;plantId:string;token:string;children:ReactNode}) {
  const key=`aeroinspect.notifications.${username}.${plantId}`;
  const [seen,setSeen]=useState<{read:string[];dismissed:string[]}>(()=>{
    try {const data=JSON.parse(localStorage.getItem(key)||'null');return {read:Array.isArray(data?.read)?data.read:[],dismissed:Array.isArray(data?.dismissed)?data.dismissed:[]};}
    catch{return {read:[],dismissed:[]};}
  });
  const [feed,setFeed]=useState<ActivityFeed>({activity:[],notifications:[]});
  const [loading]=useState(false),[error]=useState('');
  useEffect(()=>{
    const prepend=(items:ActivityItem[],item:ActivityItem)=>[item,...items.filter(existing=>existing.id!==item.id)].slice(0,200);
    return subscribeActivityUpdates(token,update=>setFeed(current=>({
      activity:update.activity?.plantId===plantId?prepend(current.activity,update.activity):current.activity,
      notifications:update.notification?.plantId===plantId?prepend(current.notifications,update.notification):current.notifications
    })));
  },[plantId,username,token]);
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(seen));}catch{/* Keep read state in memory when storage is unavailable. */}},[key,seen]);
  const notifications=feed.notifications.filter(item=>!seen.dismissed.includes(item.id));
  const markRead=()=>setSeen(old=>({...old,read:[...new Set([...old.read,...notifications.map(i=>i.id)])].slice(-1000)}));
  const dismiss=(id:string)=>setSeen(old=>({...old,dismissed:[...new Set([...old.dismissed,id])].slice(-1000)}));
  return <ActivityContext.Provider value={{...feed,notifications,loading,error,unread:notifications.filter(i=>!seen.read.includes(i.id)).length,markRead,dismiss}}>{children}</ActivityContext.Provider>;
}
