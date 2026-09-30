import { prisma } from "../prisma";

export class BackupService {
  /**
   * Generates a complete dump of the database (workers, aliases, ledger entries)
   */
  static async exportFullBackup() {
    const workers = await prisma.worker.findMany({
      orderBy: { created_at: "asc" },
    });

    const aliases = await prisma.workerAlias.findMany({
      orderBy: { created_at: "asc" },
    });

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      orderBy: [{ entry_date: "asc" }, { created_at: "asc" }],
    });

    return {
      backup_version: "1.0.0",
      app: "Worker Debt Ledger",
      exported_at: new Date().toISOString(),
      counts: {
        workers: workers.length,
        aliases: aliases.length,
        ledger_entries: ledgerEntries.length,
      },
      data: {
        workers,
        aliases,
        ledger_entries: ledgerEntries,
      },
    };
  }
}
