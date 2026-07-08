const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');

const IMPORT_DIR = '/var/www/kibilov-backend/uploads/ftp-imports';
const PROCESSED_FILE = '/var/www/kibilov-backend/uploads/ftp-processed.json';

function loadProcessed() {
  try { return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf-8')); }
  catch { return []; }
}

function saveProcessed(list) {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(list), 'utf-8');
}

async function checkFTP() {
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const watchDir = process.env.FTP_WATCH_DIR || '/export';

  if (!host || !user) {
    console.log('[FTP] No credentials configured');
    return [];
  }

  if (!fs.existsSync(IMPORT_DIR)) fs.mkdirSync(IMPORT_DIR, { recursive: true });

  const client = new ftp.Client();
  client.ftp.verbose = false;
  const newFiles = [];
  const processed = loadProcessed();

  try {
    await client.access({ host, user, password, secure: false });
    const list = await client.list(watchDir);

    const xlsxFiles = list.filter(f =>
      !f.isDirectory && /\.(xlsx|csv|xls)$/i.test(f.name) && !processed.includes(f.name)
    );

    for (const file of xlsxFiles) {
      const localPath = path.join(IMPORT_DIR, `${Date.now()}_${file.name}`);
      await client.downloadTo(localPath, `${watchDir}/${file.name}`);
      processed.push(file.name);
      newFiles.push({ filePath: localPath, filename: file.name, date: file.modifiedAt });
      console.log(`[FTP] Downloaded: ${file.name}`);
    }

    saveProcessed(processed);
  } catch (e) {
    console.error('[FTP] Error:', e.message);
  } finally {
    client.close();
  }

  return newFiles;
}

module.exports = { checkFTP };
