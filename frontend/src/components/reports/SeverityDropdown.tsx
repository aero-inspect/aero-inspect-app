import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { BackendReport } from "../../api/types";
const options = [{value:"LOW",label:"Baja"},{value:"MEDIUM",label:"Media"},{value:"HIGH",label:"Alta"},{value:"CRITICAL",label:"Crítica"},{value:"NOT_REPORTED",label:"Sin determinar"}] as const;
export function SeverityDropdown({ value, label, disabled, onChange }: {value:BackendReport["severity"];label:string;disabled:boolean|undefined;onChange:(value:BackendReport["severity"])=>void}) {
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);const id=useId();
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener("mousedown",close);root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();return()=>document.removeEventListener("mousedown",close);},[open]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 return <div className="severity-dropdown" ref={root} onKeyDown={e=>{
  if(e.key==="Escape"){setOpen(false);trigger.current?.focus();}
  if(open&&["ArrowDown","ArrowUp","Home","End"].includes(e.key)){
   e.preventDefault();const items=[...(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')??[])];const current=items.indexOf(document.activeElement as HTMLButtonElement);
   const index=e.key==="Home"?0:e.key==="End"?items.length-1:(current+(e.key==="ArrowDown"?1:-1)+items.length)%items.length;items[index]?.focus();
  }
 }}><button ref={trigger} type="button" className="severity-dropdown-trigger" data-severity={value} disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}><span>{options.find(o=>o.value===value)?.label??"Sin determinar"}</span><ChevronDown size={16}/></button>{open&&<div id={id} role="listbox" aria-label={`Opciones de ${label}`} className="severity-dropdown-menu">{options.map(o=><button type="button" role="option" key={o.value} data-severity={o.value} aria-selected={value===o.value} onClick={()=>{onChange(o.value);setOpen(false);trigger.current?.focus();}}><span>{o.label}</span>{value===o.value&&<Check size={16}/>}</button>)}</div>}</div>;
}
