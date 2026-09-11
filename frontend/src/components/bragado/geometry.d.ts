import type { Scene, Box3, Matrix4 } from 'three';
export function buildPlant(scene: Scene, heightScale: number, numbers: Record<string, number>, tubes: Array<{id:string;from:string;to:string;noria:number}>, inspectionVolumes?:Array<{box:Box3;matrix:Matrix4}>): Box3[];
