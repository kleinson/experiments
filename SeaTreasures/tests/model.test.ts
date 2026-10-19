import test from 'node:test'
import assert from 'node:assert/strict'
import { bounded, getShape } from '../src/model.ts'

test('nonfinite growth and bounds values cannot become silent defaults', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => bounded(value, 0, 100), RangeError)
    assert.throws(() => getShape(value), RangeError)
  }
  assert.equal(bounded(-5, 0, 100), 0)
  assert.equal(bounded(500, 0, 100), 100)
})

test('one coherent cowrie model enlarges the shell and narrows its opening', () => {
  let previous = getShape(0)
  for (let progress = 1; progress <= 100; progress++) {
    const shape = getShape(progress)
    assert.ok(shape.scale > previous.scale)
    assert.ok(shape.opening < previous.opening)
    assert.ok(shape.teeth >= previous.teeth)
    assert.ok(shape.coilVisibility <= previous.coilVisibility)
    assert.ok(shape.opening > 0)
    previous = shape
  }
  assert.equal(getShape(0).teeth, 0)
  assert.equal(getShape(100).coilVisibility, 0)
  assert.equal(getShape(100).teeth, 1)
})
