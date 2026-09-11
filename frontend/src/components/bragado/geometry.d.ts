import type { Scene, Box3 } from 'three';
export function buildPlant(scene: Scene, heightScale: number, numbers: Record<string, number>, tubes: Array<{id:string;from:string;to:string;noria:number}>): Box3[];
