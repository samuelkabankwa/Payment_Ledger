import stringSimilarity from "string-similarity";
import { prisma } from "../prisma";

export interface MatchResult {
  suggested_worker: {
    id: string;
    name: string;
    phone: string | null;
    matched_on: "name" | "alias" | "phone";
    matched_text: string;
    similarity: number;
  } | null;
  all_workers: Array<{
    id: string;
    name: string;
    car_type: string | null;
    number_plate: string | null;
  }>;
}

/**
 * Normalize text for fuzzy comparison:
 * lowercase, replace hyphens and underscores with spaces, collapse spaces
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize phone numbers to last 9 digits for comparison
 * (e.g. 233540276077 -> 540276077, 0540276077 -> 540276077)
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

export class FuzzyMatchService {
  private static SIMILARITY_THRESHOLD = 0.6;

  /**
   * Matches an extracted sender name and/or phone against all active workers and their aliases
   */
  static async matchSender(
    senderName: string | null,
    senderPhone?: string | null
  ): Promise<MatchResult> {
    const workers = await prisma.worker.findMany({
      where: {
        status: { in: ["ACTIVE", "INACTIVE"] }, // include both active and inactive
      },
      include: {
        aliases: true,
      },
    });

    const allWorkersDropdown = workers.map((w) => ({
      id: w.id,
      name: w.name,
      car_type: w.car_type,
      number_plate: w.number_plate,
    }));

    // 1. Phone match check (highest confidence)
    if (senderPhone) {
      const normSenderPhone = normalizePhone(senderPhone);
      if (normSenderPhone) {
        for (const worker of workers) {
          const normWorkerPhone = normalizePhone(worker.phone);
          if (normWorkerPhone && normWorkerPhone === normSenderPhone) {
            return {
              suggested_worker: {
                id: worker.id,
                name: worker.name,
                phone: worker.phone,
                matched_on: "phone",
                matched_text: worker.phone || senderPhone,
                similarity: 1.0,
              },
              all_workers: allWorkersDropdown,
            };
          }
        }
      }
    }

    // 2. Name / Alias fuzzy match
    if (!senderName || senderName.trim().length === 0) {
      return {
        suggested_worker: null,
        all_workers: allWorkersDropdown,
      };
    }

    const normSenderName = normalizeString(senderName);
    let bestMatch: MatchResult["suggested_worker"] = null;
    let highestScore = 0;

    for (const worker of workers) {
      // Check worker's own name
      const normWorkerName = normalizeString(worker.name);
      const nameScore = stringSimilarity.compareTwoStrings(normSenderName, normWorkerName);

      if (nameScore > highestScore && nameScore >= this.SIMILARITY_THRESHOLD) {
        highestScore = nameScore;
        bestMatch = {
          id: worker.id,
          name: worker.name,
          phone: worker.phone,
          matched_on: "name",
          matched_text: worker.name,
          similarity: Math.round(nameScore * 100) / 100,
        };
      }

      // Check worker's aliases
      for (const alias of worker.aliases) {
        const normAlias = normalizeString(alias.alias_name);
        const aliasScore = stringSimilarity.compareTwoStrings(normSenderName, normAlias);

        if (aliasScore > highestScore && aliasScore >= this.SIMILARITY_THRESHOLD) {
          highestScore = aliasScore;
          bestMatch = {
            id: worker.id,
            name: worker.name,
            phone: worker.phone,
            matched_on: "alias",
            matched_text: alias.alias_name,
            similarity: Math.round(aliasScore * 100) / 100,
          };
        }
      }
    }

    return {
      suggested_worker: bestMatch,
      all_workers: allWorkersDropdown,
    };
  }
}
