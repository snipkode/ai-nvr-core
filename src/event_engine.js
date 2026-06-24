'use strict';
const { EventEmitter } = require('events');

/**
 * Rule-based event engine.
 * Receives raw detection JSON, applies user-defined rules, emits 'alert'.
 *
 * Built-in rule types:
 *   - object_presence  : trigger when class detected
 *   - zone_intrusion   : trigger when object enters a polygon zone
 *   - object_count     : trigger when count of a class exceeds threshold
 *   - loitering        : trigger when same object class seen for N consecutive frames
 *   - after_hours      : combine object_presence with time window (HH:MM–HH:MM)
 */
class EventEngine extends EventEmitter {
  constructor() {
    super();
    this._rules = [];
    // loitering state: { ruleId: { count, firstSeen } }
    this._loiterState = {};
  }

  /**
   * Add a detection rule.
   * @param {object} rule - { id, type, classes[], zone?, threshold?, duration?, hours? }
   */
  addRule(rule) {
    this._rules.push(rule);
  }

  removeRule(id) {
    this._rules = this._rules.filter(r => r.id !== id);
    delete this._loiterState[id];
  }

  /**
   * Process a detection result object.
   * @param {object} detection - parsed JSON from addon
   */
  process(detection) {
    if (!detection || !Array.isArray(detection.objects)) return;

    for (const rule of this._rules) {
      const matched = this._evaluate(rule, detection);
      if (matched) {
        this.emit('alert', {
          rule_id:   rule.id,
          rule_type: rule.type,
          camera_id: detection.camera_id,
          timestamp: detection.timestamp,
          objects:   detection.objects,
          severity:  rule.severity || 'medium'
        });
      }
    }
  }

  _evaluate(rule, det) {
    const objs = det.objects;
    switch (rule.type) {
      case 'object_presence':
        return objs.some(o => rule.classes.includes(o.class));

      case 'zone_intrusion': {
        if (!rule.zone) return false;
        const inZone = objs.filter(o =>
          rule.classes.includes(o.class) &&
          this._bboxInZone(o.bbox, rule.zone)
        );
        return inZone.length > 0;
      }

      case 'object_count': {
        const count = objs.filter(o => rule.classes.includes(o.class)).length;
        return count >= (rule.threshold || 1);
      }

      case 'loitering': {
        const present = objs.some(o => rule.classes.includes(o.class));
        const state   = this._loiterState[rule.id] || { count: 0, firstSeen: 0 };
        if (present) {
          if (!state.firstSeen) state.firstSeen = det.timestamp;
          state.count++;
          const elapsed = det.timestamp - state.firstSeen;
          this._loiterState[rule.id] = state;
          return elapsed >= (rule.duration || 30000);
        } else {
          this._loiterState[rule.id] = { count: 0, firstSeen: 0 };
          return false;
        }
      }

      case 'after_hours': {
        if (!rule.hours) return false;
        const [start, end] = rule.hours.split('-').map(t => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        });
        const now   = new Date(det.timestamp);
        const mins  = now.getHours() * 60 + now.getMinutes();
        const inAfterHours = start < end
          ? (mins < start || mins > end)   // daytime window → after hours = outside
          : (mins > end && mins < start);  // overnight window
        return inAfterHours && objs.some(o => rule.classes.includes(o.class));
      }

      default:
        return false;
    }
  }

  /** Check if bbox center is inside a polygon zone [[x,y],...] */
  _bboxInZone(bbox, polygon) {
    const [x, y, w, h] = bbox;
    const cx = x + w / 2, cy = y + h / 2;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      const intersect = (yi > cy) !== (yj > cy) &&
                        cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}

module.exports = EventEngine;
