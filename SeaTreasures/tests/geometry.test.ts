import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createShellGeometry,
  createSpireGeometry,
  makeSpots,
  shellPoint,
  shellSegments,
} from '../src/geometry.ts'
import { getShape } from '../src/model.ts'

test('procedural shell geometry has finite coordinates, normals, UVs and bounds', () => {
  for (const progress of [0, 24, 25, 50, 74, 75, 100]) {
    const geometry = createShellGeometry(progress)
    const expected =
      (shellSegments.length + 1) * (shellSegments.circumference + 1)
    assert.equal(geometry.getAttribute('position').count, expected)
    for (const attribute of ['position', 'normal', 'uv']) {
      assert.ok(
        Array.from(geometry.getAttribute(attribute).array).every(
          Number.isFinite,
        ),
      )
    }
    assert.ok(geometry.boundingSphere)
    assert.ok(Number.isFinite(geometry.boundingSphere.radius))
    assert.ok(geometry.boundingSphere.radius > 0)
    assert.equal(
      geometry.index?.count,
      shellSegments.length * shellSegments.circumference * 6,
    )
    geometry.dispose()
  }
})

test('a real opening is left underneath the mesh, not painted onto a closed oval', () => {
  for (const progress of [0, 50, 100]) {
    const shape = getShape(progress)
    const left = shellPoint(0.5, -Math.PI + shape.opening, progress)
    const right = shellPoint(0.5, Math.PI - shape.opening, progress)
    assert.ok(left.z < 0)
    assert.ok(right.z > 0)
    assert.equal(left.y, right.y)
    assert.ok(left.y < 0)
    assert.ok(right.z - left.z > 0)
  }
})

test('the conceptual juvenile opening is wider relative to the shell than the adult one', () => {
  const normalizedGap = (progress: number) => {
    const shape = getShape(progress)
    const a = shellPoint(0.5, Math.PI - shape.opening, progress)
    return Math.abs(a.z) / (shape.width * shape.scale)
  }
  assert.ok(normalizedGap(0) > normalizedGap(100) * 5)
})

test('mantle patches remain finite at zero and full coverage through all stages', () => {
  for (const region of ['mantle-left', 'mantle-right'] as const) {
    for (const progress of [0, 50, 100]) {
      for (const coverage of [0, 50, 100]) {
        const geometry = createShellGeometry(progress, region, coverage)
        assert.ok(
          Array.from(geometry.getAttribute('position').array).every(
            Number.isFinite,
          ),
        )
        geometry.dispose()
      }
    }
  }
})

test('all spots are reproducible original artwork, not random render-time noise', () => {
  assert.deepEqual(makeSpots(), makeSpots())
  assert.equal(makeSpots().length, 420)
  for (const spot of makeSpots()) {
    assert.ok(spot.u > 0 && spot.u < 1)
    assert.ok(spot.v > 0 && spot.v < 1)
    assert.ok(spot.opacity > 0 && spot.opacity <= 1)
  }
})

test('juvenile spire is a dimensional attached whorl, not a floating decorative spiral', () => {
  const geometry = createSpireGeometry()
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  assert.ok(box)
  assert.ok(box.min.x >= 1.5 && box.max.x < 2)
  assert.ok(box.max.y < 0.4 && box.min.y > -0.4)
  assert.ok(
    Array.from(geometry.getAttribute('position').array).every(Number.isFinite),
  )
  geometry.dispose()
})

test('full mantle coverage meets along the dorsal center without an accidental uncovered stripe', () => {
  const left = createShellGeometry(100, 'mantle-left', 100)
  const right = createShellGeometry(100, 'mantle-right', 100)
  const row = Math.floor(shellSegments.length / 2)
  const columns = shellSegments.circumference + 1
  const a = left.getAttribute('position')
  const b = right.getAttribute('position')
  const leftIndex = row * columns + shellSegments.circumference
  const rightIndex = row * columns
  assert.ok(Math.abs(a.getX(leftIndex) - b.getX(rightIndex)) < 1e-6)
  assert.ok(Math.abs(a.getY(leftIndex) - b.getY(rightIndex)) < 1e-6)
  assert.ok(Math.abs(a.getZ(leftIndex) - b.getZ(rightIndex)) < 1e-6)
  left.dispose()
  right.dispose()
})
