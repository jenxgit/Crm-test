// Full-database export, used by the download endpoint and the scheduled R2 backup.

export interface BackupEnv {
  DB: D1Database;
  BACKUP_BUCKET?: R2Bucket;
}

const TABLES = ["customers", "tours", "tasks", "rooms", "invoices", "invoice_items", "bookings", "payments"];

export const dumpDatabase = async (env: BackupEnv) => {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${t}`).all();
    tables[t] = results;
  }
  return { exportedAt: new Date().toISOString(), tables };
};

// Writes backups/YYYY-MM-DD.json to R2 and prunes copies older than `keepDays`.
export const runScheduledBackup = async (env: BackupEnv, keepDays = 90) => {
  if (!env.BACKUP_BUCKET) return;
  const dump = await dumpDatabase(env);
  const key = `backups/${dump.exportedAt.slice(0, 10)}.json`;
  await env.BACKUP_BUCKET.put(key, JSON.stringify(dump), { httpMetadata: { contentType: "application/json" } });

  const cutoff = Date.now() - keepDays * 86_400_000;
  const listed = await env.BACKUP_BUCKET.list({ prefix: "backups/" });
  const old = listed.objects.filter((o) => o.uploaded.getTime() < cutoff).map((o) => o.key);
  if (old.length) await env.BACKUP_BUCKET.delete(old);
};
