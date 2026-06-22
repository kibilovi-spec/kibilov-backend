'use strict';
const express = require('express');
const { prisma, authenticate } = require('../middleware/auth');
const router = express.Router();

const SERVICE_TYPES = {
  'oil_change':   { ka: 'ზეთის შეცვლა',      intervalDays: 90,   intervalKm: 10000 },
  'brake_pads':   { ka: 'ხუნდების შეცვლა',    intervalDays: 365,  intervalKm: 40000 },
  'air_filter':   { ka: 'ჰაერის ფილტრი',      intervalDays: 365,  intervalKm: 20000 },
  'timing_belt':  { ka: 'მატოს რემენი',        intervalDays: 1460, intervalKm: 80000 },
  'tires':        { ka: 'საბურავები',          intervalDays: 1460, intervalKm: 50000 },
  'spark_plugs':  { ka: 'სანთლები',            intervalDays: 730,  intervalKm: 30000 },
  'coolant':      { ka: 'ანტიფრიზი',           intervalDays: 730,  intervalKm: 40000 },
  'cabin_filter': { ka: 'სალონის ფილტრი',      intervalDays: 365,  intervalKm: 15000 },
  'brake_fluid':  { ka: 'სამუხრუჭე სითხე',    intervalDays: 730,  intervalKm: null  },
  'transmission': { ka: 'გადაცემათა კოლოფი',  intervalDays: 730,  intervalKm: 60000 },
};

router.get('/types', (req, res) => {
  res.json({ success: true, data: SERVICE_TYPES });
});

router.get('/', authenticate, async (req, res) => {
  try {
    const reminders = await prisma.maintenanceReminder.findMany({
      where: { userId: req.user.id },
      orderBy: { nextDue: 'asc' }
    });
    const now = new Date();
    const enriched = reminders.map(r => {
      const daysLeft = Math.ceil((new Date(r.nextDue) - now) / 86400000);
      const status = daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'urgent' : daysLeft <= 30 ? 'soon' : 'ok';
      return { ...r, daysLeft, status };
    });
    res.json({ success: true, data: enriched });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { make, model, year, serviceType, lastDone, mileage, notes, vehicleId } = req.body;
    if (!make || !model || !serviceType || !lastDone)
      return res.status(422).json({ success: false, message: 'make, model, serviceType, lastDone სავალდებულოა' });
    const svc = SERVICE_TYPES[serviceType];
    if (!svc) return res.status(422).json({ success: false, message: 'სერვის ტიპი არასწორია' });
    const lastDate = new Date(lastDone);
    const nextDue = new Date(lastDate);
    nextDue.setDate(nextDue.getDate() + (svc.intervalDays || 90));
    const reminder = await prisma.maintenanceReminder.create({
      data: {
        userId: req.user.id,
        vehicleId: vehicleId || null,
        make, model,
        year: parseInt(year) || new Date().getFullYear(),
        serviceType,
        lastDone: lastDate,
        intervalDays: svc.intervalDays,
        intervalKm: svc.intervalKm,
        nextDue,
        mileage: mileage ? parseInt(mileage) : null,
        notes: notes || null,
      }
    });
    res.status(201).json({ success: true, data: { ...reminder, daysLeft: Math.ceil((nextDue - new Date()) / 86400000) } });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.maintenanceReminder.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
