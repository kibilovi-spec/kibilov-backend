'use strict';
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function authenticate(req, res, next) {
  const token =
    req.headers.authorization?.replace('Bearer ', '') ||
    req.cookies?.access_token;

  if (!token) return res.status(401).json({ success: false, message: 'ავტორიზაცია საჭიროა' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    const code = e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return res.status(401).json({ success: false, message: 'ტოკენი არასწორია', code });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'წვდომა აკრძალულია' });
  next();
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.access_token;
  if (!token) return next();
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch {}
  next();
}

function requireRole(...allowedRoles) {
  return function(req, res, next) {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'წვდომა აკრძალულია' });
    }
    next();
  };
}
// STAFF-ს შეუძლია read-only admin გვერდების ნახვა, მაგრამ არა სენსიტიური ცვლილებები
function requireStaffOrAdmin(req, res, next) {
  if (!['ADMIN', 'STAFF'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'წვდომა აკრძალულია' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireRole, requireStaffOrAdmin, optionalAuth, prisma };
