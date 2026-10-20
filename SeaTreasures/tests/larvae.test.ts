import test from 'node:test'
import assert from 'node:assert/strict'
import { BufferGeometry, Material, Vector3 } from 'three'
import {
  buildGastropodLarva,
  larvalSize,
  protoconchGeometry,
} from '../src/sim/larvae.ts'
import { buildSiblings } from '../src/sim/siblings.ts'
import { suspension } from '../src/sim/suspension.ts'

test('the protoconch is an open coiled shell with finite vertices and normals', () => {
  const geometry = protoconchGeometry()
  const vertices = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  for (let i = 0; i < vertices.count; i++)
    for (const value of [
      vertices.getX(i),
      vertices.getY(i),
      vertices.getZ(i),
      normals.getX(i),
      normals.getY(i),
      normals.getZ(i),
    ])
      assert.ok(Number.isFinite(value))
  assert.ok(geometry.index)
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!
  assert.ok(
    Math.abs(bounds.max.x - bounds.min.x - 1) < 0.00001,
    'unit width preserves mm scale',
  )
  const indices = new Set(geometry.index.array)
  assert.ok(
    indices.has(vertices.count - 1),
    'open aperture is part of the surface',
  )
  assert.equal(
    larvalSize('tiger-cowrie', 0),
    0.22,
    '220 µm, not an adult scaled down',
  )
  assert.ok(larvalSize('tiger-cowrie', 1) < 0.31)
  geometry.dispose()
})

test('both early and later veligers build, and siblings share a single instanced model', () => {
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const own = {
    geometry<T extends BufferGeometry>(value: T) {
      geometries.push(value)
      return value
    },
    material<T extends Material>(value: T) {
      materials.push(value)
      return value
    },
  }
  for (const maturity of [0, 0.5, 1]) {
    const larva = buildGastropodLarva(0.22, own, maturity)
    larva.velum.beat(10)
    assert.ok(larva.group.children.length > 3)
  }
  const siblings = buildSiblings(0.22, 2, new Vector3(), () => 0.7)
  assert.equal(siblings.group.children.length, 1)
  siblings.dispose()
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
})

test('marine snow settles at no more than 1.2 screen pixels a second at 800px high', () => {
  for (const height of [0.1, 0.6, 2, 100, 800, 8000]) {
    const width = height * 1.6
    const motion = suspension(width, height)
    // Includes the fastest particle's shader pace of 1.5.
    assert.ok((motion.sink / height) * 800 * 1.5 <= 1.200001)
    assert.ok((motion.drift / width) * 1280 <= 1.920001)
    assert.ok(motion.sway / width <= 0.008001)
  }
})
