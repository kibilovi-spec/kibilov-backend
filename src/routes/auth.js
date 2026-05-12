'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { prisma, authenticate } = require('../middleware/auth');

const ERRORS = {
  ka: { emailTaken:'ეს Email უკვე დარეგისტრირებულია', badCreds:'Email ან პაროლი არასწორია', nameReq:'სახელი სავალდებულოა', emailReq:'Email სავალდებულოა', passWeak:'პაროლი: მინ.6, 1 დიდი, 1 ციფრი', noToken:'ტოკენი ვერ მოიძებნა', expired:'სესია ამოიწურა, შეხვიდე ხელახლა' },
  en: { emailTaken:'Email already registered', badCreds:'Invalid email or password', nameReq:'Name required', emailReq:'Email required', passWeak:'Password: min 6, 1 uppercase, 1 digit', noToken:'Token not found', expired:'Session expired, please log in again' },
  ru: { emailTaken:'Email уже зарегистрирован', badCreds:'Неверный email или пароль', nameReq:'Имя обязательно', emailReq:'Email обязателен', passWeak:'Пароль: мин.6, 1 заглавная, 1 цифра', noToken:'Токен не найден', expired:'Сессия истекла, войдите снова' },
};
const t = (lang, key) => ERRORS[lang]?.[key] ?? ERRORS.ka[key];

function makeTokens(user) {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken  = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });
  return { accessToken, refreshToken };
}

function setCookies(res, access, refresh) {
  const prod = process.env.NODE_ENV === 'production';
  res.cookie('access_token',  access,  { httpOnly:true, secure:prod, sameSite:'lax', maxAge:7*24*60*60*1000 });
  res.cookie('refresh_token', refresh, { httpOnly:true, secure:prod, sameSite:'lax', path:'/api/auth/refresh', maxAge:30*24*60*60*1000 });
}

const safe = u => ({ id:u.id, name:u.name, email:u.email, phone:u.phone, role:u.role, lang:u.lang, createdAt:u.createdAt });

// POST /api/auth/register
router.post('/register', [
  body('name').trim().isLength({ min:2, max:60 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min:6 }).matches(/[A-Z]/).matches(/[0-9]/),
], async (req, res) => {
  const lang = req.body.lang || 'ka';
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(422).json({ success:false, message: t(lang,'passWeak'), errors: errs.array() });

  const { name, email, password, phone } = req.body;
  const exists = await prisma.user.findUnique({ where:{ email } });
  if (exists) return res.status(409).json({ success:false, message: t(lang,'emailTaken') });

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data:{ name, email, password:hash, phone, lang } });
  await prisma.cart.create({ data:{ userId: user.id } });

  const { accessToken, refreshToken } = makeTokens(user);
  await prisma.refreshToken.create({ data:{ token:refreshToken, userId:user.id, expiresAt: new Date(Date.now()+30*24*60*60*1000) } });
  setCookies(res, accessToken, refreshToken);

  res.status(201).json({ success:true, message:'რეგისტრაცია წარმატებული!', user: safe(user), accessToken });
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const lang = req.body.lang || 'ka';
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where:{ email } });
  if (!user || !await bcrypt.compare(password, user.password))
    return res.status(401).json({ success:false, message: t(lang,'badCreds') });
  if (!user.isActive) return res.status(403).json({ success:false, message:'ანგარიში დაბლოკილია' });

  const { accessToken, refreshToken } = makeTokens(user);
  await prisma.refreshToken.create({ data:{ token:refreshToken, userId:user.id, expiresAt: new Date(Date.now()+30*24*60*60*1000) } });
  setCookies(res, accessToken, refreshToken);

  res.json({ success:true, message:'შესვლა წარმატებული!', user: safe(user), accessToken });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const lang = req.body?.lang || 'ka';
  const token = req.cookies?.refresh_token || req.body?.refreshToken;
  if (!token) return res.status(401).json({ success:false, message: t(lang,'noToken') });

  const stored = await prisma.refreshToken.findUnique({ where:{ token } });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where:{ token } });
    return res.status(401).json({ success:false, message: t(lang,'expired') });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where:{ id: decoded.id } });
    if (!user) return res.status(401).json({ success:false, message:'მომხმარებელი არ მოიძებნა' });

    await prisma.refreshToken.delete({ where:{ token } });
    const { accessToken, refreshToken: newRefresh } = makeTokens(user);
    await prisma.refreshToken.create({ data:{ token:newRefresh, userId:user.id, expiresAt: new Date(Date.now()+30*24*60*60*1000) } });
    setCookies(res, accessToken, newRefresh);
    res.json({ success:true, accessToken });
  } catch {
    res.status(401).json({ success:false, message: t(lang,'expired') });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) await prisma.refreshToken.deleteMany({ where:{ token } }).catch(()=>{});
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path:'/api/auth/refresh' });
  res.json({ success:true, message:'გამოსვლა წარმატებული' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where:{ id: req.user.id } });
  if (!user) return res.status(404).json({ success:false, message:'მომხმარებელი არ მოიძებნა' });
  res.json({ success:true, user: safe(user) });
});

// PUT /api/auth/me
router.put('/me', authenticate, async (req, res) => {
  const { name, phone, lang, password } = req.body;
  const data = {};
  if (name)  data.name = name;
  if (phone) data.phone = phone;
  if (lang)  data.lang = lang;
  if (password) data.password = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({ where:{ id: req.user.id }, data });
  res.json({ success:true, user: safe(user) });
});

module.exports = router;
