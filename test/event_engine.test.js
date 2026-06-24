'use strict';
const { test } = require('node:test');
const assert   = require('node:assert/strict');
const EventEngine = require('../src/event_engine');

const det = (objects, ts = Date.now()) => ({
  camera_id: 'cam1', timestamp: ts, objects
});
const person = { class: 'person', confidence: 0.9, bbox: [10, 10, 50, 100] };
const car    = { class: 'car',    confidence: 0.8, bbox: [100, 100, 80, 60] };

test('object_presence — fires on matching class', (t) => {
  const ee = new EventEngine();
  ee.addRule({ id: 'r1', type: 'object_presence', classes: ['person'], severity: 'high' });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  ee.process(det([person]));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].rule_id, 'r1');
  assert.equal(alerts[0].severity, 'high');
});

test('object_presence — no fire when class absent', () => {
  const ee = new EventEngine();
  ee.addRule({ id: 'r1', type: 'object_presence', classes: ['person'] });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  ee.process(det([car]));
  assert.equal(alerts.length, 0);
});

test('zone_intrusion — fires when bbox center inside polygon', () => {
  const ee = new EventEngine();
  // zone covers 0,0 → 200,200
  ee.addRule({ id: 'r2', type: 'zone_intrusion', classes: ['person'],
    zone: [[0,0],[200,0],[200,200],[0,200]] });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  ee.process(det([person])); // center = 35,60 → inside
  assert.equal(alerts.length, 1);
});

test('zone_intrusion — no fire when bbox center outside polygon', () => {
  const ee = new EventEngine();
  ee.addRule({ id: 'r2', type: 'zone_intrusion', classes: ['person'],
    zone: [[300,300],[500,300],[500,500],[300,500]] });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  ee.process(det([person]));
  assert.equal(alerts.length, 0);
});

test('object_count — fires when count >= threshold', () => {
  const ee = new EventEngine();
  ee.addRule({ id: 'r3', type: 'object_count', classes: ['person'], threshold: 2 });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  ee.process(det([person]));
  assert.equal(alerts.length, 0);

  ee.process(det([person, { ...person }]));
  assert.equal(alerts.length, 1);
});

test('loitering — fires after duration exceeded', () => {
  const ee = new EventEngine();
  ee.addRule({ id: 'r4', type: 'loitering', classes: ['person'], duration: 1000 });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  const now = Date.now();
  ee.process(det([person], now));
  assert.equal(alerts.length, 0);

  ee.process(det([person], now + 2000)); // 2s elapsed > 1s duration
  assert.equal(alerts.length, 1);
});

test('loitering — resets when object disappears', () => {
  const ee = new EventEngine();
  ee.addRule({ id: 'r4', type: 'loitering', classes: ['person'], duration: 1000 });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  const now = Date.now();
  ee.process(det([person], now));
  ee.process(det([], now + 500));       // disappeared → reset
  ee.process(det([person], now + 600));
  ee.process(det([person], now + 700)); // only 100ms since reset
  assert.equal(alerts.length, 0);
});

test('after_hours — fires outside allowed window', () => {
  const ee = new EventEngine();
  ee.addRule({ id: 'r5', type: 'after_hours', classes: ['person'], hours: '08:00-18:00' });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  // Force a timestamp at 03:00 (after hours)
  const d = new Date(); d.setHours(3, 0, 0, 0);
  ee.process(det([person], d.getTime()));
  assert.equal(alerts.length, 1);
});

test('after_hours — no fire inside allowed window', () => {
  const ee = new EventEngine();
  ee.addRule({ id: 'r5', type: 'after_hours', classes: ['person'], hours: '08:00-18:00' });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  const d = new Date(); d.setHours(12, 0, 0, 0);
  ee.process(det([person], d.getTime()));
  assert.equal(alerts.length, 0);
});

test('removeRule — stops firing after removal', () => {
  const ee = new EventEngine();
  ee.addRule({ id: 'r1', type: 'object_presence', classes: ['person'] });
  let alerts = [];
  ee.on('alert', a => alerts.push(a));

  ee.process(det([person]));
  assert.equal(alerts.length, 1);

  ee.removeRule('r1');
  ee.process(det([person]));
  assert.equal(alerts.length, 1); // no new alert
});
