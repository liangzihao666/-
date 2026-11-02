import { Object3D, Vector3 } from 'three'

/**
 * 斐波那契球面姓名牌落点。
 * 排布与 log-lottery 的 createSphereVertices 一致
 * （https://github.com/LOG1997/log-lottery ，MIT），
 * 也就是 Three.js CSS3D 元素周期表示例里的球面公式。
 */
export function createSphereTargets(count, radius) {
  const targets = []
  const vector = new Vector3()
  for (let i = 0; i < count; i += 1) {
    const phi = Math.acos(-1 + (2 * i) / count)
    const theta = Math.sqrt(count * Math.PI) * phi
    const object = new Object3D()
    object.position.set(
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      -radius * Math.cos(phi),
    )
    vector.copy(object.position).multiplyScalar(2)
    object.lookAt(vector)
    targets.push(object)
  }
  return targets
}
