'use strict';
const { test } = require('node:test');
const assert   = require('node:assert/strict');
const NvrEngine = require('../src/nvr_engine');

test('NvrEngine — instantiates without model', () => {
  const nvr = new NvrEngine({ cameras: [], rules: [] });
  assert.ok(nvr);
});

test('NvrEngine — addRule / removeRule work at runtime', () => {
  const nvr = new NvrEngine({});
  nvr.addRule({ id: 'r1', type: 'object_presence', classes: ['person'] });
  assert.equal(nvr._eventEngine._rules.length, 1);
  nvr.removeRule('r1');
  assert.equal(nvr._eventEngine._rules.length, 0);
});

test('NvrEngine — emits event when EventEngine fires alert', () => {
  const nvr = new NvrEngine({});
  nvr.addRule({ id: 'r1', type: 'object_presence', classes: ['person'], severity: 'high' });
  let events = [];
  nvr.on('event', e => events.push(e));

  // Directly drive the event engine (no camera needed)
  nvr._eventEngine.process({
    camera_id: 'cam1', timestamp: Date.now(),
    objects: [{ class: 'person', confidence: 0.9, bbox: [0,0,50,100] }]
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].rule_id, 'r1');
  assert.equal(events[0].severity, 'high');
});

test('NvrEngine — stop() is idempotent when not started', () => {
  const nvr = new NvrEngine({});
  assert.doesNotThrow(() => { nvr.stop(); nvr.stop(); });
});

test('NvrEngine — enableWebSocket returns engine (chainable)', async (t) => {
  const nvr = new NvrEngine({});
  const result = nvr.enableWebSocket(19321);
  assert.equal(result, nvr);
  nvr.stop(); // closes wss
});
