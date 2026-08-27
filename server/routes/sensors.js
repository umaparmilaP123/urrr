'use strict';
/**
 * routes/sensors.js
 * GET /api/iot-sensors — returns all sensor rows
 */

const { Router } = require('express');
const db = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM iot_sensors ORDER BY id').all();
  const sensors = rows.map(r => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    status: r.status,
    location: [r.lat, r.lon],
    updatedAt: r.updated_at,
  }));
  res.json(sensors);
});

module.exports = router;
