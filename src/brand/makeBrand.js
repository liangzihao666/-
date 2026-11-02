import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import glyphs from './wordmark-paths.json'

/**
 * 挤出官网 BrandScene.makeBrand()：三角标志（箭头 #0869ac + 扫光 #079bb8）
 * 以及立体字 aunion。页面上不再另写平面 AUNION。
 */
function extrudedPaths(path, color) {
  const group = new THREE.Group()
  const svg = new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path fill="${color}" fill-rule="nonzero" d="${path}"/></svg>`,
  )
  for (const pathData of svg.paths) {
    for (const shape of pathData.toShapes()) {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 96,
        bevelEnabled: true,
        bevelSize: 2.2,
        bevelThickness: 2.8,
        bevelSegments: 5,
        curveSegments: 40,
        steps: 1,
      })
      const face = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.12,
        roughness: 0.28,
        envMapIntensity: 0.72,
        emissive: color,
        emissiveIntensity: 0.22,
      })
      const edge = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.42,
        roughness: 0.22,
        envMapIntensity: 1,
        emissive: color,
        emissiveIntensity: 0.08,
      })
      group.add(new THREE.Mesh(geometry, [face, edge]))
    }
  }
  return group
}

export function makeBrand() {
  const group = new THREE.Group()
  group.name = 'aunion-brand'
  const units = []
  const symbol = new THREE.Group()
  const arrow = extrudedPaths('M 15 140 L 515 0 L 390 500 L 293 360 L 357 150 L 145 210 Z', '#0869ac')
  const sweep = extrudedPaths('M 0 249 L 145 210 Q 240 278 293 360 Q 304 383 287 415 L 270 520 Q 156 335 0 249 Z', '#079bb8')
  for (const part of [arrow, sweep]) {
    part.scale.y = -1
    symbol.add(part)
  }
  symbol.position.set(0, 590, 0)
  group.add(symbol)
  units.push(symbol)

  let cursor = 850
  for (const letter of 'aunion') {
    const glyph = glyphs[letter]
    const unit = extrudedPaths(glyph.path, '#0869ac')
    unit.position.set(cursor, 238, 0)
    group.add(unit)
    units.push(unit)
    cursor += glyph.advance + 5
  }

  symbol.scale.setScalar(1.42)
  symbol.position.y = 800
  units.forEach((unit) => {
    unit.updateWorldMatrix(true, true)
    const localCenter = unit.worldToLocal(new THREE.Box3().setFromObject(unit).getCenter(new THREE.Vector3()))
    unit.children.forEach(child => child.position.sub(localCenter))
    unit.position.add(localCenter.multiply(unit.scale))
  })

  const bounds = new THREE.Box3().setFromObject(group)
  const center = bounds.getCenter(new THREE.Vector3())
  const scale = 8.5 / bounds.getSize(new THREE.Vector3()).x
  units.forEach((unit) => {
    unit.position.sub(center).multiplyScalar(scale)
    unit.scale.multiplyScalar(scale)
  })
  return group
}

export function setBrandEmissive(group, intensity) {
  group.traverse((mesh) => {
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach((material) => {
      if (material.emissive) material.emissiveIntensity = intensity
    })
  })
}
