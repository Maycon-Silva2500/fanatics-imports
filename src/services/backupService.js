/**
 * FANATICS IMPORTS — SERVIÇO DE BACKUP AUTOMÁTICO E SOB DEMANDA DO BANCO DE DADOS
 * Desenvolvido por Maycon Silva
 */

const fs = require('fs');
const path = require('path');
const { dbPath, dbRun } = require('../config/db');

const backupDir = path.resolve(__dirname, '../../database/backups');
const MAX_BACKUPS_TO_KEEP = 20;

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

function getTimestampSlug() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(
    now.getMinutes()
  )}-${pad(now.getSeconds())}`;
}

async function createDatabaseBackup(prefix = 'manual') {
  if (!fs.existsSync(dbPath)) {
    throw new Error('Arquivo principal do banco de dados ainda não existe.');
  }

  const fileName = `fanatics-${prefix}-${getTimestampSlug()}.sqlite`;
  const destinationPath = path.join(backupDir, fileName);

  try {
    // Usa VACUUM INTO para gerar backup consistente mesmo com conexões ativas
    const escapedPath = destinationPath.replace(/'/g, "''");
    await dbRun(`VACUUM INTO '${escapedPath}'`);
  } catch {
    // Fallback para cópia direta caso necessário
    fs.copyFileSync(dbPath, destinationPath);
  }

  cleanOldBackups();

  const stats = fs.statSync(destinationPath);
  return {
    filename: fileName,
    sizeBytes: stats.size,
    sizeKB: (stats.size / 1024).toFixed(2),
    createdAt: stats.birthtime.toISOString()
  };
}

function listBackups() {
  if (!fs.existsSync(backupDir)) return [];

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith('.sqlite'))
    .map((filename) => {
      const fullPath = path.join(backupDir, filename);
      const stats = fs.statSync(fullPath);
      return {
        filename,
        sizeBytes: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2),
        createdAt: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return files;
}

function cleanOldBackups() {
  const backups = listBackups();
  if (backups.length <= MAX_BACKUPS_TO_KEEP) return;

  const toDelete = backups.slice(MAX_BACKUPS_TO_KEEP);
  toDelete.forEach((b) => {
    try {
      fs.unlinkSync(path.join(backupDir, b.filename));
    } catch {}
  });
}

async function ensureDailyAutoBackup() {
  const todayPrefix = `fanatics-auto-${new Date().toISOString().slice(0, 10)}`;
  const existing = listBackups();
  const alreadyBackedUpToday = existing.some((b) => b.filename.startsWith(todayPrefix));

  if (!alreadyBackedUpToday) {
    const created = await createDatabaseBackup('auto');
    console.log(`[BACKUP OK] Backup diário automático criado: ${created.filename}`);
  }
}

function getBackupFilePath(filename) {
  const safeName = path.basename(filename);
  if (!safeName.endsWith('.sqlite')) return null;
  const fullPath = path.join(backupDir, safeName);
  return fs.existsSync(fullPath) ? fullPath : null;
}

module.exports = {
  createDatabaseBackup,
  listBackups,
  ensureDailyAutoBackup,
  getBackupFilePath
};