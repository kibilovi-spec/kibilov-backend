'use strict';
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024 } });

router.post('/image', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ფაილი საჭიროა' });
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'kibilov/products', transformation: [{ width: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] },
        (error, result) => error ? reject(error) : resolve(result)
      ).end(req.file.buffer);
    });
    res.json({ success: true, url: result.secure_url });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.post('/sign', async (req, res) => {
  res.json({ success: true });
});

module.exports = router;
