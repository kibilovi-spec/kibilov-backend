const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const IMPORT_DIR = '/var/www/kibilov-backend/uploads/cloud-imports';

class GoogleDriveWatcher {
  constructor() {
    const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!creds) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
    
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(creds),
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    this.drive = google.drive({ version: 'v3', auth });
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  }

  async checkForNewFiles(since) {
    if (!this.folderId) return [];

    const query = [
      `'${this.folderId}' in parents`,
      `trashed = false`,
      `(mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'text/csv')`,
    ];
    if (since) query.push(`modifiedTime > '${since}'`);

    const res = await this.drive.files.list({
      q: query.join(' and '),
      fields: 'files(id, name, modifiedTime, mimeType)',
      orderBy: 'modifiedTime desc',
      pageSize: 10
    });

    return res.data.files || [];
  }

  async downloadFile(fileId, filename) {
    if (!fs.existsSync(IMPORT_DIR)) fs.mkdirSync(IMPORT_DIR, { recursive: true });
    const destPath = path.join(IMPORT_DIR, `${Date.now()}_${filename}`);
    const dest = fs.createWriteStream(destPath);
    const res = await this.drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    return new Promise((resolve, reject) => {
      res.data.pipe(dest);
      dest.on('finish', () => resolve(destPath));
      dest.on('error', reject);
    });
  }
}

module.exports = { GoogleDriveWatcher };
