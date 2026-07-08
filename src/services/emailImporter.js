const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');

const IMPORT_DIR = '/var/www/kibilov-backend/uploads/email-imports';

const imapConfig = {
  user: process.env.IMPORT_EMAIL_USER,
  password: process.env.IMPORT_EMAIL_PASS,
  host: process.env.IMPORT_EMAIL_HOST || 'imap.gmail.com',
  port: parseInt(process.env.IMPORT_EMAIL_PORT || '993'),
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

async function checkEmails() {
  if (!imapConfig.user || !imapConfig.password) {
    console.log('[EmailImport] No credentials configured, skipping');
    return [];
  }

  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);
    const attachments = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) { imap.end(); return reject(err); }

        imap.search(['UNSEEN'], (err, results) => {
          if (err || !results.length) {
            imap.end();
            return resolve([]);
          }

          const f = imap.fetch(results, { bodies: '', markSeen: true });
          let pending = results.length;

          f.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (err) { pending--; return; }

                const validAttachments = (parsed.attachments || []).filter(a =>
                  a.filename && /\.(xlsx|csv|xls)$/i.test(a.filename)
                );

                validAttachments.forEach(att => {
                  const filePath = path.join(IMPORT_DIR, `${Date.now()}_${att.filename}`);
                  fs.writeFileSync(filePath, att.content);
                  attachments.push({
                    filePath,
                    filename: att.filename,
                    from: parsed.from?.text || 'unknown',
                    subject: parsed.subject || '',
                    date: parsed.date
                  });
                });

                pending--;
                if (pending === 0) {
                  imap.end();
                  resolve(attachments);
                }
              });
            });
          });

          f.once('error', (err) => { imap.end(); reject(err); });
          f.once('end', () => {
            setTimeout(() => {
              if (pending > 0) { imap.end(); resolve(attachments); }
            }, 10000);
          });
        });
      });
    });

    imap.once('error', (err) => reject(err));
    imap.connect();
  });
}

module.exports = { checkEmails };
