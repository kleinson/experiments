import type { Material } from 'three'

/**
 * Swaying in the water, done on the GPU: each vertex carries how far it moves
 * (`aSway.x`, world units) and a phase (`aSway.y`), and the vertex shader
 * moves it. The CPU only advances one clock per frame, however many blades of
 * seagrass or soft corals there are.
 */
export const swayClock = { value: 0 }

export function swaying<T extends Material>(material: T): T {
  if (material.userData.swaying) return material
  material.userData.swaying = true
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer)
    shader.uniforms.swayTime = swayClock
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec2 aSway;\nuniform float swayTime;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          // A slow surge with a quicker flutter on top, travelling across the reef.
          float ph = aSway.y + swayTime;
          float surge = sin(ph * 0.55 + transformed.x * 0.004) + 0.35 * sin(ph * 1.7 + 0.8);
          transformed.x += surge * aSway.x;
          transformed.z += cos(ph * 0.45 + 1.3) * aSway.x * 0.6;
        }`,
      )
  }
  const key = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () => `${key?.() ?? ''}|sway`
  material.needsUpdate = true
  return material
}

/** Gives a stand-in material (a drawn or outline twin) the same sway as its source. */
export function swayLike<T extends Material>(twin: T, source: Material): T {
  return source.userData.swaying ? swaying(twin) : twin
}
