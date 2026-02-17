const test = require('node:test');
const assert = require('node:assert/strict');

const {
  autoThresholds,
  calculateCategoryScore,
  getWeekKey,
  normalize,
  weekInputToWeekKey,
  weekKeyToInputValue
} = require('../.test-dist/src/utils/scoring.js');

test('autoThresholds derives avg and goal from weak/elite', () => {
  const metric = autoThresholds({
    id: 'miles',
    label: 'Miles',
    unit: 'mi/wk',
    current: 13,
    weak: 3,
    elite: 30,
    type: 'higher_better',
    desc: 'd',
    tip: 't'
  });

  assert.equal(metric.avg, 12);
  assert.equal(metric.goal, 21);
});

test('normalize supports higher_better and lower_better bounds', () => {
  const higher = {
    id: 'a',
    label: 'A',
    unit: 'u',
    current: 0,
    weak: 0,
    avg: 33,
    goal: 66,
    elite: 100,
    type: 'higher_better',
    desc: '',
    tip: ''
  };

  const lower = {
    ...higher,
    id: 'b',
    type: 'lower_better',
    weak: 100,
    elite: 0
  };

  assert.equal(normalize(higher, -10), 0);
  assert.equal(normalize(higher, 200), 1);
  assert.equal(normalize(lower, -10), 1);
  assert.equal(normalize(lower, 200), 0);
});

test('calculateCategoryScore maps 66% progress to about 100 points', () => {
  const metric = {
    id: 'focus',
    label: 'Focus',
    unit: 'hrs',
    current: 66,
    weak: 0,
    avg: 33,
    goal: 66,
    elite: 100,
    type: 'higher_better',
    desc: '',
    tip: ''
  };

  assert.equal(calculateCategoryScore([metric]), 100);
});

test('week conversions are stable and sunday-based', () => {
  const weekKey = getWeekKey('2026-02-17T12:00:00Z');
  assert.equal(weekKey, '2026-02-15');

  const weekInput = weekKeyToInputValue(weekKey);
  assert.equal(weekInput, '2026-W08');

  assert.equal(weekInputToWeekKey(weekInput), weekKey);
  assert.equal(weekInputToWeekKey('invalid'), null);
});
