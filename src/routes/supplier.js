'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { calcPrices } = require('../services/pricing');
const multer = require('multer');
const XLSX = require('xlsx');
const { sendSupplierListingApproved, sendSupplierListingRejected } = require('../services/email');
const { createNotification } = require('../services/supplierNotify');
const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/supplier/register
router.post('/register', async (req, res) => {
  try {
    const { companyName, contactName, phone, address, taxId, description, email, password } = req.body;
    if (!companyName || !contactName || !phone) return res.status(400).json({ success: false, message: 'შეავსეთ სავალდებულო ველები' });
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email და პაროლი სავალდებულოა' });
    const bcrypt = require('bcryptjs');
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ success: false, message: 'ეს Email უკვე გამოყენებულია' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name: contactName, phone, role: 'USER' }
    });
    const supplier = await prisma.supplier.create({
      data: { userId: user.id, companyName, contactName, phone, address: address||'', taxId: taxId||'', bankAccount: '', status: 'PENDING' }
    });
    try {
      const { notifyNewSupplier } = require('../services/notification');
      await notifyNewSupplier(supplier, user);
    } catch(e) {}
    res.json({ success: true, data: supplier });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/supplier/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'მომწოდებელი არ მოიძებნა' });
    res.json({ success: true, data: supplier });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});



// PATCH /api/supplier/change-password
router.patch('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'ველები სავალდებულოა' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'პაროლი მინიმუმ 6 სიმბოლო' });
    const bcrypt = require('bcryptjs');
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'მიმდინარე პაროლი არასწორია' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ success: true });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});
// PATCH /api/supplier/profile — პროფილის განახლება
router.patch('/profile', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ error: 'მომწოდებელი არ მოიძებნა' });
    const { companyName, contactName, phone, address, taxId, bankAccount } = req.body;
    const updated = await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        ...(companyName && { companyName }),
        ...(contactName && { contactName }),
        ...(phone && { phone }),
        ...(address !== undefined && { address }),
        ...(taxId !== undefined && { taxId }),
        ...(bankAccount !== undefined && { bankAccount }),
      }
    });
    res.json({ success: true, data: updated });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});
// GET /api/supplier/listings
router.post('/listings', authenticate, upload.none(), async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'მომწოდებელი არ მოიძებნა' });
    if (supplier.status !== 'APPROVED') return res.status(403).json({ success: false, message: 'ანგარიში დამტკიცებული არ არის' });
    const { nameKa, nameEn, sku, brand, price, stock, description, images, image0, image1, image2, categoryId, oem, barcode } = req.body;
    if (!nameKa || !sku || !brand || !price) return res.status(400).json({ success: false, message: 'შეავსეთ სავალდებულო ველები' });
    // image0/1/2 ან images array
    let imageArr = [];
    if (images) { try { imageArr = typeof images==='string'?JSON.parse(images):images; } catch(e){} }
    if (image0) imageArr.push(image0);
    if (image1) imageArr.push(image1);
    if (image2) imageArr.push(image2);
    imageArr = imageArr.filter(Boolean);
    const oemCodes = (oem || '').split(',').map(s => s.trim()).filter(Boolean);
    const listing = await prisma.productListing.create({
      data: {
        supplierId: supplier.id,
        nameKa, nameEn: nameEn || nameKa, sku, brand,
        price: parseFloat(price),
        stock: parseInt(stock) || 0,
        description: description || '',
        images: imageArr,
        oemCodes,
        ...(barcode ? { barcode: String(barcode).trim() } : {}),
        autodocCategoryId: categoryId ? parseInt(categoryId) : null,
        status: 'PENDING',
      }
    });
    res.json({ success: true, data: listing });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/listings', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false });
    const listings = await prisma.productListing.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: listings });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/supplier/payouts
router.get('/payouts', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false });
    const payouts = await prisma.supplierPayout.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: payouts });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/supplier/upload — Excel ატვირთვა
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(403).json({ success: false, message: 'მომწოდებელი არ ხარ' });
    if (!req.file) return res.status(400).json({ success: false, message: 'ფაილი არ არის' });
    const { importSupplierExcelBuffer } = require('../services/supplierExcelImport');
    const markup = parseFloat(req.body.markup || '0') || 0;
    const result = await importSupplierExcelBuffer(supplier.id, req.file.buffer, 'MANUAL_EXCEL', req.file.originalname, markup);
    res.json({
      success: true, added: result.added, updated: result.updated, skipped: result.skipped,
      rejected: result.rejected, total: result.total, importLogId: result.importLogId,
      message: result.rejected > 0
        ? `${result.added + result.updated} პროდუქტი აიტვირთა, ${result.rejected} პროდუქტი ვერ დადასტურდა 100%-იანი სიზუსტით და საიტზე არ განთავსდა — ნახეთ Rejected რეპორტი`
        : `${result.added + result.updated} პროდუქტი წარმატებით აიტვირთა`,
    });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/supplier/bulk-image-upload — ფოლდერით სურათების ატვირთვა, SKU-ს
// მიხედვით (ფაილის სახელი = SKU). მხოლოდ ამ supplier-ის საკუთარ listing-ებზე.
async function findListingForFilename(prisma, supplierId, base) {
  let listing = await prisma.productListing.findFirst({ where: { supplierId, sku: { equals: base, mode: 'insensitive' } } });
  if (listing) return listing;
  const stripped = base.replace(/[_\-]\s?\d{1,2}$/, '');
  if (stripped !== base) {
    listing = await prisma.productListing.findFirst({ where: { supplierId, sku: { equals: stripped, mode: 'insensitive' } } });
    if (listing) return listing;
  }
  return null;
}
router.post('/bulk-image-upload', authenticate, upload.array('images', 500), async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(403).json({ success: false, message: 'მომწოდებელი არ ხარ' });
    if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'ფაილები არ არის' });

    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const byListing = new Map();
    const unmatched = [];
    for (const file of req.files) {
      const base = file.originalname.replace(/\.[^.]+$/, '').trim();
      const listing = await findListingForFilename(prisma, supplier.id, base);
      if (!listing) { unmatched.push(file.originalname); continue; }
      if (!byListing.has(listing.id)) byListing.set(listing.id, { listing, files: [] });
      byListing.get(listing.id).files.push(file);
    }

    const matched = [];
    const errors = [];
    for (const { listing, files } of byListing.values()) {
      const urls = [];
      for (const file of files) {
        try {
          const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({ folder: 'kibilov/products' }, (error, result) => error ? reject(error) : resolve(result));
            stream.end(file.buffer);
          });
          urls.push(result.secure_url);
        } catch (e) { errors.push(`${listing.sku}: ${e.message}`); }
      }
      if (urls.length) {
        const newImages = [...(listing.images || []), ...urls].slice(0, 5);
        await prisma.productListing.update({ where: { id: listing.id }, data: { images: newImages } });
        matched.push({ sku: listing.sku, nameKa: listing.nameKa, count: urls.length });
      }
    }

    res.json({ success: true, matched, unmatched, errors, totalFiles: req.files.length });
  } catch (e) {
    console.error('[supplier.js bulk-image-upload]', e);
    res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' });
  }
});
// POST /api/supplier/validate — Feed Validator: ამოწმებს ფაილს რეალურ import-ამდე, DB-ში არაფერს წერს
router.post('/validate', authenticate, upload.single('file'), async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(403).json({ success: false, message: 'მომწოდებელი არ ხარ' });
    if (!req.file) return res.status(400).json({ success: false, message: 'ფაილი არ არის' });

    const { processFinaExcel } = require('../services/finaImportEngine');
    const markup = parseFloat(req.body.markup || '0') || 0;
    const { normalized, errors, reviewQueue } = await processFinaExcel(req.file.buffer, { markup });

    res.json({
      success: true,
      valid: errors.length === 0,
      totalRows: normalized.length + errors.length,
      validRows: normalized.length,
      invalidRows: errors.length,
      needsReview: (reviewQueue || []).length,
      errors: errors.slice(0, 50),
      sample: normalized.slice(0, 5).map(r => ({ sku: r.sku, nameKa: r.nameKa, price: r.price, stock: r.stock }))
    });
  } catch(e) { console.error('[supplier.js:validate]', e); res.status(500).json({ success: false, message: 'ფაილის დამუშავება ვერ მოხერხდა — შეამოწმეთ ფორმატი' }); }
});

// GET /api/supplier/integration
router.get('/integration', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success:false, message:'მომწოდებელი არ მოიძებნა' });
    const logs = await prisma.supplierImportLog.findMany({ where: { supplierId: supplier.id }, orderBy: { createdAt: 'desc' }, take: 20 });
    res.json({ success:true, data: {
      integrationLevel: supplier.integrationLevel,
      apiKey: supplier.apiKey,
      ftpFolder: supplier.ftpFolder,
      importEmail: process.env.IMPORT_EMAIL_USER || null,
      logs
    }});
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// POST /api/supplier/integration/api-key
router.post('/integration/api-key', authenticate, async (req, res) => {
  try {
    const crypto = require('crypto');
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success:false, message:'მომწოდებელი არ მოიძებნა' });
    const key = 'sk_' + crypto.randomBytes(24).toString('hex');
    await prisma.supplier.update({ where: { id: supplier.id }, data: { apiKey: key } });
    res.json({ success:true, apiKey: key });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// PATCH /api/supplier/integration
router.patch('/integration', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success:false, message:'მომწოდებელი არ მოიძებნა' });
    const { integrationLevel, ftpFolder } = req.body;
    const data = {};
    if (integrationLevel && ['MANUAL','EMAIL','FTP','API'].includes(integrationLevel)) data.integrationLevel = integrationLevel;
    if (ftpFolder !== undefined) data.ftpFolder = ftpFolder;
    const s = await prisma.supplier.update({ where: { id: supplier.id }, data });
    res.json({ success:true, data: s });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

module.exports = router;

// ── Admin Routes ──────────────────────────────────────────────────────────────
const { requireAdmin } = require('../middleware/auth');

// GET /api/supplier/admin/all
router.get('/admin/integrations', authenticate, requireAdmin, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      select: {
        id: true, companyName: true, status: true, integrationLevel: true, apiKey: true, ftpFolder: true,
        importLogs: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { companyName: 'asc' }
    });
    res.json({ success:true, data: suppliers.map(s => ({
      id: s.id, companyName: s.companyName, status: s.status,
      integrationLevel: s.integrationLevel, hasApiKey: !!s.apiKey, ftpFolder: s.ftpFolder,
      lastImport: s.importLogs[0] || null
    }))});
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});
// GET /api/supplier/admin/import-logs/:logId/rejected-report — Excel report of rejected items
router.get('/admin/import-logs/:logId/rejected-report', authenticate, requireAdmin, async (req, res) => {
  try {
    const log = await prisma.supplierImportLog.findUnique({ where: { id: req.params.logId } });
    if (!log || !log.errorMessage) {
      return res.status(404).json({ success: false, message: 'რეპორტი ვერ მოიძებნა' });
    }
    let payload;
    try { payload = JSON.parse(log.errorMessage); } catch (e) {
      return res.status(500).json({ success: false, message: 'რეპორტის ფორმატი დაზიანებულია' });
    }
    const rows = (payload.rejected || []).map(r => ({
      'SKU': r.sku,
      'დასახელება': r.nameKa,
      'OEM კოდები': (r.oemCodes || []).join(', '),
      'Cross კოდები': (r.crossCodes || []).join(', '),
      'დარწმუნებულობა %': r.confidence,
      'მეთოდი': r.method,
      'მიზეზი': r.reason,
    }));
    const parseErrRows = (payload.parseErrors || []).map(e => ({
      'SKU': e.sku || '', 'დასახელება': '', 'OEM კოდები': '', 'Cross კოდები': '',
      'დარწმუნებულობა %': '', 'მეთოდი': '', 'მიზეზი': `PARSE_ERROR: ${e.error} (row ${e.row})`,
    }));
    const allRows = [...rows, ...parseErrRows];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(allRows.length ? allRows : [{ 'შედეგი': 'უარყოფილი პროდუქტი არ არის' }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Rejected');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rejected_${req.params.logId}.xlsx"`);
    res.send(buf);
  } catch(e) { console.error('[supplier.js:rejected-report]', e); res.status(500).json({ success: false, message: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/supplier/admin/:id/import-logs — სრული import ისტორია კონკრეტული მომწოდებლისთვის
router.get('/admin/:id/import-logs', authenticate, requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.supplierImportLog.findMany({
      where: { supplierId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ success: true, data: logs });
  } catch(e) { console.error('[supplier.js:import-logs]', e); res.status(500).json({ success: false, message: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// PATCH /api/supplier/admin/:id/integration — admin ცვლის Integration Level-ს/FTP საქაღალდეს
router.patch('/admin/:id/integration', authenticate, requireAdmin, async (req, res) => {
  try {
    const { integrationLevel, ftpFolder } = req.body;
    const validLevels = ['MANUAL', 'EXCEL', 'API', 'FTP'];
    if (integrationLevel && !validLevels.includes(integrationLevel)) {
      return res.status(400).json({ success: false, message: 'არასწორი Integration Level' });
    }
    const updated = await prisma.supplier.update({
      where: { id: req.params.id },
      data: {
        ...(integrationLevel && { integrationLevel }),
        ...(ftpFolder !== undefined && { ftpFolder })
      }
    });
    res.json({ success: true, data: { id: updated.id, integrationLevel: updated.integrationLevel, ftpFolder: updated.ftpFolder } });
  } catch(e) { console.error('[supplier.js:patch-integration]', e); res.status(500).json({ success: false, message: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/supplier/admin/:id/api-key/regenerate — ახალი API key-ის გენერაცია
router.post('/admin/:id/api-key/regenerate', authenticate, requireAdmin, async (req, res) => {
  try {
    const crypto = require('crypto');
    const newKey = 'sk_' + crypto.randomBytes(24).toString('hex');
    const updated = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { apiKey: newKey }
    });
    res.json({ success: true, data: { apiKey: updated.apiKey } });
  } catch(e) { console.error('[supplier.js:regenerate-key]', e); res.status(500).json({ success: false, message: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});


router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: { user: { select: { name: true, email: true } }, _count: { select: { listings: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: suppliers });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/supplier/admin/listings
router.get('/admin/listings', authenticate, requireAdmin, async (req, res) => {
  try {
    const listings = await prisma.productListing.findMany({
      include: { supplier: { select: { companyName: true, id: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: listings });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// PATCH /api/supplier/admin/:id/status
router.patch('/admin/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, commission } = req.body;
    const data = { status };
    if (commission) data.commission = parseFloat(commission);
    const s = await prisma.supplier.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: s });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// PATCH /api/supplier/admin/listings/:id/status
router.patch('/admin/listings/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const l = await prisma.productListing.update({ where: { id: req.params.id }, data: { status, ...(note && {description: undefined}), rejectionNote: note||null }, include: { supplier: { include: { user: true } } } });
    const email = l.supplier?.user?.email;
    const company = l.supplier?.companyName;
    if (email) {
      if (status === 'APPROVED') { sendSupplierListingApproved(email, company, l.nameKa).catch(()=>{}); createNotification(l.supplierId,'LISTING_APPROVED','✅ პროდუქტი დამტკიცდა',`${l.nameKa} საიტზე გამოქვეყნდა`,'/supplier/listings'); }
      if (status === 'REJECTED') { sendSupplierListingRejected(email, company, l.nameKa).catch(()=>{}); createNotification(l.supplierId,'LISTING_REJECTED','❌ პროდუქტი უარყოფილია',`${l.nameKa} ვერ დამტკიცდა. მიზეზი: ${note||'არ არის მითითებული'}`,'/supplier/listings'); }
    }
    // APPROVED — products table-ში ჩავწეროთ
    if (status === 'APPROVED') {
      try {
        // 🔒 თუ ეს SKU უკვე არსებობს და ხელით არის შესწორებული (dataLocked),
        // კატეგორია/OEM/ბარკოდს აღარ ვეხებით — მხოლოდ ფასი/მარაგი განახლდება
        const existingBySku = await prisma.product.findUnique({ where: { sku: l.sku }, select: { dataLocked: true } });
        const isLocked = existingBySku?.dataLocked === true;
        const product = await prisma.product.upsert({
          where: { sku: l.sku },
          update: {
            price: l.price, stock: l.stock, isActive: true,
            ...(isLocked ? {} : {
              ...(l.autodocCategoryId ? { autodocCategoryId: l.autodocCategoryId } : {}),
              ...(l.oemCodes?.length ? { oemCodes: l.oemCodes } : {}),
              ...(l.categoryConfidence ? { categoryConfidence: l.categoryConfidence } : {}),
              ...(l.categoryMethod ? { categoryMethod: l.categoryMethod } : {}),
              ...(l.barcode ? { barcode: l.barcode } : {}),
            }),
          },
          create: {
            nameKa: l.nameKa, nameEn: l.nameEn || l.nameKa,
            nameRu: l.nameKa, brand: l.brand, sku: l.sku,
            price: l.price, stock: l.stock,
            descriptionEn: l.description || '',
            images: l.images || [],
            oemCodes: l.oemCodes || [],
            autodocCategoryId: l.autodocCategoryId || null,
            categoryConfidence: l.categoryConfidence || null,
            categoryMethod: l.categoryMethod || null,
            ...(l.barcode ? { barcode: l.barcode } : {}),
            isActive: true,
          }
        });
        await prisma.productListing.update({ where: { id: l.id }, data: { productId: product.id }});
      } catch(pe) { console.error('Product create error:', pe.message); }
    }
    // REJECTED — product გავაუქმოთ
    if (status === 'REJECTED' && l.productId) {
      try { await prisma.product.update({ where: { id: l.productId }, data: { isActive: false }}); } catch(e) {}
    }
    res.json({ success: true, data: l });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/supplier/payout-request — გამოტანის მოთხოვნა
router.post('/payout-request', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'მომწოდებელი არ მოიძებნა' });
    if (supplier.balance <= 0) return res.status(400).json({ success: false, message: 'ბალანსი ნულია' });

    const payout = await prisma.supplierPayout.create({
      data: {
        supplierId: supplier.id,
        amount: supplier.balance,
        status: 'PENDING',
        note: `მოთხოვნა: ${new Date().toLocaleDateString('ka-GE')}`,
      }
    });
    // ბალანსი ნულდება
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: 0 } });

    // Admin-ს ეცნობება
    try {
      const { sendTelegram } = require('../services/notification');
      await sendTelegram(`💰 <b>Payout მოთხოვნა</b>\n${supplier.companyName}\nთანხა: ${supplier.balance}₾`);
    } catch(e) {}

    res.json({ success: true, data: payout });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/supplier/admin/payouts — ყველა payout (admin)
router.get('/admin/payouts', authenticate, requireAdmin, async (req, res) => {
  try {
    const payouts = await prisma.supplierPayout.findMany({
      include: { supplier: { select: { companyName: true, bankAccount: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: payouts });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// PATCH /api/supplier/admin/payouts/:id — გადახდა
router.patch('/admin/payouts/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const p = await prisma.supplierPayout.update({
      where: { id: req.params.id },
      data: { status, note }
    });
    res.json({ success: true, data: p });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/supplier/payout-request
router.post('/payout-request', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'მომწოდებელი არ მოიძებნა' });
    if (supplier.balance <= 0) return res.status(400).json({ success: false, message: 'ბალანსი ნულია' });
    const payout = await prisma.supplierPayout.create({
      data: { supplierId: supplier.id, amount: supplier.balance, status: 'PENDING', note: 'მოთხოვნა' }
    });
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: 0 } });
    res.json({ success: true, data: payout });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/supplier/sample — public template download
router.get('/sample', async (req, res) => {
  try {
    const { generate } = require('../services/gen_template');
    const buf = await generate(res);
    res.setHeader('Content-Disposition', 'attachment; filename=kibilov_import.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// PATCH /api/supplier/listings/:id — supplier-ს შეუძლია მხოლოდ PENDING/REJECTED პროდუქტის რედაქტირება + stock ყოველთვის
router.patch('/listings/:id', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ error: 'მომწოდებელი არ მოიძებნა' });
    const listing = await prisma.productListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'პროდუქტი არ მოიძებნა' });
    if (listing.supplierId !== supplier.id) return res.status(403).json({ error: 'წვდომა აკრძალულია' });
    const { stock, nameKa, price, description } = req.body;
    let data = {};
    // stock — ყოველთვის შეიძლება
    if (stock !== undefined) data.stock = parseInt(stock);
    // სხვა ველები — მხოლოდ PENDING ან REJECTED-ზე, და სტატუსი PENDING-ზე ბრუნდება
    if (listing.status === 'PENDING' || listing.status === 'REJECTED') {
      if (nameKa) data.nameKa = nameKa;
      if (price) data.price = parseFloat(price);
      if (description !== undefined) data.description = description;
      if (Object.keys(data).some(k => k !== 'stock')) data.status = 'PENDING';
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'შესაცვლელი მონაცემი არ მოიძებნა' });
    const updated = await prisma.productListing.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: updated });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// DELETE /api/supplier/listings/:id — supplier-ს შეუძლია მხოლოდ საკუთარი წაშლა
router.delete('/listings/:id', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ error: 'მომწოდებელი არ მოიძებნა' });
    const listing = await prisma.productListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'პროდუქტი არ მოიძებნა' });
    if (listing.supplierId !== supplier.id) return res.status(403).json({ error: 'წვდომა აკრძალულია' });
    // დამტკიცებულ პროდუქტს product-იც გავუქმოთ
    if (listing.productId) {
      await prisma.product.update({ where: { id: listing.productId }, data: { isActive: false } }).catch(()=>{});
    }
    await prisma.productListing.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/supplier/sales — supplier-ის გაყიდვების ისტორია
router.get('/sales', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ error: 'მომწოდებელი არ მოიძებნა' });
    const items = await prisma.orderItem.findMany({
      where: { product: { supplierId: supplier.id } },
      include: { order: { select: { orderNumber: true, status: true, createdAt: true } } },
      orderBy: { order: { createdAt: 'desc' } },
      take: 100
    });
    res.json({ success: true, data: items });
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/supplier/export — Excel export
router.get('/export', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ error: 'მომწოდებელი არ მოიძებნა' });
    const listings = await prisma.productListing.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: 'desc' }
    });
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('განთავსებები');
    ws.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'სახელი', key: 'nameKa', width: 30 },
      { header: 'ბრენდი', key: 'brand', width: 15 },
      { header: 'ფასი (₾)', key: 'price', width: 12 },
      { header: 'მარაგი', key: 'stock', width: 10 },
      { header: 'სტატუსი', key: 'status', width: 15 },
      { header: 'OEM კოდები', key: 'oem', width: 25 },
      { header: 'თარიღი', key: 'createdAt', width: 15 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1a2744' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    const sl = { PENDING:'განხილვაში', APPROVED:'დამტკიცებული', REJECTED:'უარყოფილი', ACTIVE:'აქტიური', INACTIVE:'არააქტიური' };
    listings.forEach(l => {
      ws.addRow({
        sku: l.sku,
        nameKa: l.nameKa,
        brand: l.brand,
        price: parseFloat(l.price),
        stock: l.stock,
        status: sl[l.status]||l.status,
        oem: l.oem||'',
        createdAt: new Date(l.createdAt).toLocaleDateString('ka-GE'),
      });
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="listings_${supplier.companyName}_${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch(e) { console.error('[supplier.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});
