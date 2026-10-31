import * as THREE from "three";

/** Subtle metric-scale surface variation, without stretching image textures
 * across long facades. This is illustrative wear, not a mapped damage survey. */
export function surface(color: number, kind: "grass" | "pitch" | "concrete" | "plaster") {
  const material = new THREE.MeshStandardMaterial({color,roughness:1});
  material.customProgramCacheKey = () => `utn-surface-${kind}`;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 utnWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nutnWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = `varying vec3 utnWorld;
      float utnHash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float utnNoise(vec3 p) {
        vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(utnHash(i),utnHash(i+vec3(1,0,0)),f.x),
          mix(utnHash(i+vec3(0,1,0)),utnHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(utnHash(i+vec3(0,0,1)),utnHash(i+vec3(1,0,1)),f.x),
          mix(utnHash(i+vec3(0,1,1)),utnHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }\n` + shader.fragmentShader;
    const variation = kind === "pitch"
      ? `float grain=utnNoise(utnWorld*35.0);
         float patches=utnNoise(utnWorld*.35);
         diffuseColor.rgb *= .93 + .06*patches + .06*grain;`
      : kind === "grass"
      ? `float patches=utnNoise(utnWorld*.55); float grain=utnNoise(utnWorld*35.0);
         diffuseColor.rgb *= .84 + .18*patches + .1*grain;
         diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.24,.22,.12),smoothstep(.7,.9,patches)*.3);`
      : `float patches=utnNoise(utnWorld*2.3); float grain=utnNoise(utnWorld*45.0);
         diffuseColor.rgb *= .88 + .14*patches + .08*grain;`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n'+variation);
  };
  return material;
}
