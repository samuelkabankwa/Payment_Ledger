import { prisma } from "../prisma";

export interface ParsedSmsResult {
  provider: "MTN" | "TELECEL" | "AT" | "BANK" | "OTHER" | "UNKNOWN";
  amount: number | null;
  entry_date: string; // ISO date string (YYYY-MM-DD)
  date_missing: boolean;
  transaction_ref: string | null;
  sender_name: string | null;
  sender_phone?: string | null;
  note: string | null;
  raw_message: string;
  success: boolean;
  pattern_name?: string;
}

/**
 * Strips commas and non-numeric characters (except period) from amount string
 * and parses to float.
 */
export function cleanAmount(rawAmount: string | null | undefined): number | null {
  if (!rawAmount) return null;
  const cleaned = rawAmount.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

/**
 * Format Date to YYYY-MM-DD in local time
 */
export function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes date string into YYYY-MM-DD
 */
export function normalizeDate(rawDateStr?: string | null): { date: string; isMissing: boolean } {
  if (!rawDateStr || !rawDateStr.trim()) {
    return { date: formatDateYYYYMMDD(new Date()), isMissing: true };
  }
  const clean = rawDateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return { date: clean, isMissing: false };
  }
  const parts = clean.split(/[/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return {
        date: `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`,
        isMissing: false,
      };
    } else if (parts[2].length === 4) {
      return {
        date: `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`,
        isMissing: false,
      };
    }
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return { date: formatDateYYYYMMDD(parsed), isMissing: false };
  }
  return { date: formatDateYYYYMMDD(new Date()), isMissing: true };
}

export class SmsParserService {
  /**
   * Parse MTN MoMo SMS across all known official formats:
   * 1. Payment received for GHS ... from ... Current Balance ... Transaction ID: ...
   * 2. Cash In received for GHS ... from ... Current Balance ... Transaction ID: ...
   * 3. You have received GHS ... from ... (phone) on ... at ... Transaction ID: ...
   * 4. Payment of GHS ... received from ... Transaction ID: ...
   * 5. Payment received from ... for GHS ... Transaction ID: ...
   */
  static parseMtn(text: string): ParsedSmsResult | null {
    const isMtn =
      /MTN|MoMo|Mobile Money/i.test(text) ||
      text.includes("Payment received for GHS") ||
      text.includes("Cash In received for GHS") ||
      text.includes("Current Balance: GHS") ||
      text.includes("Available Balance: GHS");

    if (!isMtn) return null;

    let amount: number | null = null;
    let senderName: string | null = null;
    let senderPhone: string | null = null;
    let transactionRef: string | null = null;
    let note: string | null = null;
    let entryDate = formatDateYYYYMMDD(new Date());
    let dateMissing = true;

    // Pattern 1: Standard Payment Received
    // "Payment received for GHS 410.00 from Kofi Oduro  Current Balance: ..."
    const p1 = /Payment received for GHS\s*([\d,]+\.?\d*)\s+from\s+(.+?)(?:\s+Current Balance|\s+Available Balance|\.\s*Current|\.\s*$)/i;
    const m1 = text.match(p1);
    if (m1) {
      amount = cleanAmount(m1[1]);
      senderName = m1[2].trim();
    }

    // Pattern 2: Cash In / Deposit Received
    // "Cash In received for GHS 200.00 from BOYE TENNO ENTERPRISE. Current Balance..."
    if (!amount) {
      const p2 = /Cash In received for GHS\s*([\d,]+\.?\d*)\s+from\s+(.+?)(?:\.|\s+Current Balance|\s+Available Balance)/i;
      const m2 = text.match(p2);
      if (m2) {
        amount = cleanAmount(m2[1]);
        senderName = m2[2].trim();
      }
    }

    // Pattern 3: "You have received GHS ... from ... (phone) on YYYY-MM-DD at HH:MM:SS"
    if (!amount) {
      const p3 = /(?:MTN Mobile Money:?\s*)?You have received GHS\s*([\d,]+\.?\d*)\s+from\s+(.+?)(?:\s*\(([\d+]+)\))?\s+on\s+(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/i;
      const m3 = text.match(p3);
      if (m3) {
        amount = cleanAmount(m3[1]);
        senderName = m3[2].trim();
        if (m3[3]) senderPhone = m3[3].trim();
        const dateResult = normalizeDate(m3[4]);
        entryDate = dateResult.date;
        dateMissing = dateResult.isMissing;
      }
    }

    // Pattern 4: "Payment received from ... for GHS ..."
    if (!amount) {
      const p4 = /Payment received from\s+(.+?)\s+for GHS\s*([\d,]+\.?\d*)/i;
      const m4 = text.match(p4);
      if (m4) {
        senderName = m4[1].trim();
        amount = cleanAmount(m4[2]);
      }
    }

    // Pattern 5: "Payment of GHS ... received from ..."
    if (!amount) {
      const p5 = /Payment of GHS\s*([\d,]+\.?\d*)\s+received from\s+(.+?)(?:\s+on|\.|$)/i;
      const m5 = text.match(p5);
      if (m5) {
        amount = cleanAmount(m5[1]);
        senderName = m5[2].trim();
      }
    }

    // Extract Transaction ID
    const txMatch = text.match(/(?:Transaction ID|Trans ID|Txn ID|Tx ID|Reference ID)[:\s]+([A-Za-z0-9/_-]+)/i);
    if (txMatch) {
      transactionRef = txMatch[1].trim();
    }

    // Extract Reference / Note
    const refMatch = text.match(/Reference:\s*(.+?)(?:\.\s*(?:Transaction ID|Trans ID|Current Balance)|$)/i);
    if (refMatch) {
      note = refMatch[1].trim();
    }

    // Clean sender name from trailing punctuation or commas
    if (senderName) {
      senderName = senderName.replace(/[.,;]+$/, "").trim();
    }

    if (!amount && !transactionRef) return null;

    return {
      provider: "MTN",
      amount,
      entry_date: entryDate,
      date_missing: dateMissing,
      transaction_ref: transactionRef,
      sender_name: senderName,
      sender_phone: senderPhone,
      note,
      raw_message: text,
      success: !!(amount && transactionRef),
      pattern_name: "MTN MoMo Built-in",
    };
  }

  /**
   * Parse Telecel Cash (formerly Vodafone Cash) SMS across all known formats:
   * 1. Leading 16-digit ID: "0000014592375973 Confirmed. You have received GHS56.00 ..."
   * 2. "Telecel Cash: You have received GHS ... on YYYY-MM-DD ... Transaction ID: ..."
   * 3. "Confirmed. You have received GHS ... from ... Transaction ID: ..."
   * 4. Cash In format: "Cash In of GHS ... confirmed on ..."
   */
  static parseTelecel(text: string): ParsedSmsResult | null {
    const isTelecel =
      /^(\d{16})\s+Confirmed\./i.test(text) ||
      /Telecel|Vodafone/i.test(text) ||
      (text.includes("Confirmed.") && text.includes("You have received GHS"));

    if (!isTelecel) return null;

    let transactionRef: string | null = null;
    let amount: number | null = null;
    let senderPhone: string | null = null;
    let senderName: string | null = null;
    let entryDate = formatDateYYYYMMDD(new Date());
    let dateMissing = true;
    let note: string | null = null;

    // 1. Check leading 16-digit ref
    const leadingTxMatch = text.match(/^(\d{16})\s+Confirmed\./i);
    if (leadingTxMatch) {
      transactionRef = leadingTxMatch[1].trim();
    }

    // 2. Extract amount: GHS56.00 or GHS 56.00
    const amtMatch = text.match(/(?:received|of)\s+GHS\s*([\d,]+\.?\d*)/i);
    if (amtMatch) {
      amount = cleanAmount(amtMatch[1]);
    }

    // 3. Sender phone, name and date:
    // Format A: "Transfer From: 233540276077-DANKYI-EBENEZER on 2026-09-22 at 06:26:04"
    // Format B: "from 233504938290 - OPPONG-NANA KWEKU on 2026-09-19"
    // Format C: "from KWESI APPIAH on 2026-09-28"
    const senderWithPhone = text.match(/(?:from|Transfer From:?)\s*(\d{9,12})\s*-\s*([^.\n\r]+?)\s+on\s+(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/i);
    if (senderWithPhone) {
      senderPhone = senderWithPhone[1].trim();
      senderName = senderWithPhone[2].trim();
      const dateResult = normalizeDate(senderWithPhone[3]);
      entryDate = dateResult.date;
      dateMissing = dateResult.isMissing;
    } else {
      const senderWithoutPhone = text.match(/(?:from|Transfer From:?)\s*([^.\n\r]+?)\s+on\s+(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/i);
      if (senderWithoutPhone) {
        senderName = senderWithoutPhone[1].trim();
        const dateResult = normalizeDate(senderWithoutPhone[2]);
        entryDate = dateResult.date;
        dateMissing = dateResult.isMissing;
      }
    }

    // 4. If transactionRef not found at start, look for Transaction ID / Txn ID
    if (!transactionRef) {
      const txMatch = text.match(/(?:Transaction ID|Txn ID|Trans ID|Tx ID|Ref ID)[:\s]+([A-Za-z0-9]+)/i);
      if (txMatch) {
        transactionRef = txMatch[1].trim();
      }
    }

    // 5. Note / Ref
    const refMatch = text.match(/(?:Ref|Reference):\s*([^.\n\r]+)/i);
    if (refMatch) {
      note = refMatch[1].trim();
    }

    if (senderName) {
      senderName = senderName.replace(/[.,;]+$/, "").trim();
    }

    if (!amount && !transactionRef) return null;

    return {
      provider: "TELECEL",
      amount,
      entry_date: entryDate,
      date_missing: dateMissing,
      transaction_ref: transactionRef,
      sender_name: senderName,
      sender_phone: senderPhone,
      note,
      raw_message: text,
      success: !!(amount && transactionRef),
      pattern_name: "Telecel Cash Built-in",
    };
  }

  /**
   * Parse AT Money (formerly AirtelTigo) SMS
   */
  static parseAT(text: string): ParsedSmsResult | null {
    const isAT = /ATMoney|AT Money|AirtelTigo/i.test(text);
    if (!isAT) return null;

    let amount: number | null = null;
    let senderName: string | null = null;
    let senderPhone: string | null = null;
    let transactionRef: string | null = null;

    const amtMatch = text.match(/(?:received|for)\s+GHS\s*([\d,]+\.?\d*)/i);
    if (amtMatch) amount = cleanAmount(amtMatch[1]);

    const senderMatch = text.match(/from\s+([^.(]+?)(?:\s*\(([\d+]+)\))?(?:\.|\s+Your|\s+Reference|$)/i);
    if (senderMatch) {
      senderName = senderMatch[1].trim();
      if (senderMatch[2]) senderPhone = senderMatch[2].trim();
    }

    const refMatch = text.match(/(?:Reference|Transaction ID|Trans ID)[:\s]+([A-Za-z0-9]+)/i);
    if (refMatch) transactionRef = refMatch[1].trim();

    return {
      provider: "AT",
      amount,
      entry_date: formatDateYYYYMMDD(new Date()),
      date_missing: true,
      transaction_ref: transactionRef,
      sender_name: senderName,
      sender_phone: senderPhone,
      note: null,
      raw_message: text,
      success: !!(amount && transactionRef),
      pattern_name: "AT Money Built-in",
    };
  }

  /**
   * Parse using trained dynamic patterns stored in PostgreSQL
   */
  static async parseWithCustomPatterns(text: string): Promise<ParsedSmsResult | null> {
    try {
      const patterns = await prisma.smsPattern.findMany({
        where: { is_active: true },
        orderBy: { created_at: "desc" },
      });

      for (const p of patterns) {
        try {
          const regex = new RegExp(p.pattern_regex, "i");
          const match = text.match(regex);
          if (!match) continue;

          let amount: number | null = null;
          if (p.amount_group && match[p.amount_group]) {
            amount = cleanAmount(match[p.amount_group]);
          }

          let transactionRef: string | null = null;
          if (p.ref_group && match[p.ref_group]) {
            transactionRef = match[p.ref_group].trim();
          }

          let senderName: string | null = null;
          if (p.sender_group && match[p.sender_group]) {
            senderName = match[p.sender_group].trim().replace(/[.,;]+$/, "");
          }

          let senderPhone: string | null = null;
          if (p.phone_group && match[p.phone_group]) {
            senderPhone = match[p.phone_group].trim();
          }

          let entryDate = formatDateYYYYMMDD(new Date());
          let dateMissing = p.date_missing;
          if (p.date_group && match[p.date_group]) {
            const dateRes = normalizeDate(match[p.date_group]);
            entryDate = dateRes.date;
            dateMissing = dateRes.isMissing;
          }

          let note: string | null = null;
          if (p.note_group && match[p.note_group]) {
            note = match[p.note_group].trim();
          }

          if (amount !== null || transactionRef !== null) {
            return {
              provider: (p.provider as any) || "OTHER",
              amount,
              entry_date: entryDate,
              date_missing: dateMissing,
              transaction_ref: transactionRef,
              sender_name: senderName,
              sender_phone: senderPhone,
              note,
              raw_message: text,
              success: !!(amount && transactionRef),
              pattern_name: `Custom Pattern: ${p.name}`,
            };
          }
        } catch (regexErr) {
          console.error(`Error matching pattern "${p.name}":`, regexErr);
        }
      }
    } catch (err) {
      console.error("Error reading custom SMS patterns:", err);
    }

    return null;
  }

  /**
   * Generic fallback heuristic parser
   */
  static parseGeneric(text: string): ParsedSmsResult {
    let amount: number | null = null;
    const amountMatch = text.match(/(?:GHS|GH[¢c]|GHC)\s*([\d,]+\.?\d*)/i);
    if (amountMatch) {
      amount = cleanAmount(amountMatch[1]);
    }

    let transactionRef: string | null = null;
    const txMatch = text.match(/(?:Transaction ID|Trans\.?\s*ID|Txn\.?\s*ID|Tx ID|Reference ID|Ref ID|Ref|ID)[:\s]+([A-Za-z0-9/_-]+)/i);
    if (txMatch) {
      transactionRef = txMatch[1].trim();
    } else {
      // Look for a 10-18 digit standalone transaction number
      const numMatch = text.match(/\b\d{10,18}\b/);
      if (numMatch) {
        transactionRef = numMatch[0];
      }
    }

    let senderName: string | null = null;
    const senderMatch = text.match(/(?:from|by|Transfer From:?)\s+([A-Za-z0-9\s-]+?)(?:\s+(?:Current Balance|Available Balance|on|\.|\n|$))/i);
    if (senderMatch) {
      senderName = senderMatch[1].trim().replace(/[.,;]+$/, "");
    }

    let entryDate = formatDateYYYYMMDD(new Date());
    let dateMissing = true;
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/);
    if (dateMatch) {
      const d = normalizeDate(dateMatch[1]);
      entryDate = d.date;
      dateMissing = d.isMissing;
    }

    let provider: "MTN" | "TELECEL" | "AT" | "BANK" | "OTHER" | "UNKNOWN" = "UNKNOWN";
    if (/MTN|MoMo/i.test(text)) provider = "MTN";
    else if (/Telecel|Vodafone/i.test(text)) provider = "TELECEL";
    else if (/ATMoney|AT Money|AirtelTigo/i.test(text)) provider = "AT";
    else if (/Bank|Credit Alert|GhanaPay/i.test(text)) provider = "BANK";

    return {
      provider,
      amount,
      entry_date: entryDate,
      date_missing: dateMissing,
      transaction_ref: transactionRef,
      sender_name: senderName,
      sender_phone: null,
      note: null,
      raw_message: text,
      success: !!(amount && transactionRef),
      pattern_name: "Generic Fallback",
    };
  }

  /**
   * Main entry point:
   * 1. Try trained database patterns first
   * 2. Try MTN formats
   * 3. Try Telecel formats
   * 4. Try AT Money
   * 5. Try Generic heuristic parser
   */
  static async parse(rawText: string): Promise<ParsedSmsResult> {
    const text = (rawText || "").trim();

    // 1. Try trained custom patterns from database
    const customResult = await this.parseWithCustomPatterns(text);
    if (customResult && (customResult.amount !== null || customResult.transaction_ref !== null)) {
      return customResult;
    }

    // 2. Try MTN
    const mtnResult = this.parseMtn(text);
    if (mtnResult && (mtnResult.amount !== null || mtnResult.transaction_ref !== null)) {
      return mtnResult;
    }

    // 3. Try Telecel
    const telecelResult = this.parseTelecel(text);
    if (telecelResult && (telecelResult.amount !== null || telecelResult.transaction_ref !== null)) {
      return telecelResult;
    }

    // 4. Try AT Money
    const atResult = this.parseAT(text);
    if (atResult && (atResult.amount !== null || atResult.transaction_ref !== null)) {
      return atResult;
    }

    // 5. Fallback
    return this.parseGeneric(text);
  }

  /**
   * Helper to automatically generate and verify a regex pattern given an example SMS
   * and the user-specified target field extractions.
   */
  static generateRegexPattern(
    exampleSms: string,
    extracted: {
      amount?: string | number | null;
      transaction_ref?: string | null;
      sender_name?: string | null;
      sender_phone?: string | null;
      date?: string | null;
      note?: string | null;
    }
  ): {
    pattern_regex: string;
    amount_group: number | null;
    ref_group: number | null;
    sender_group: number | null;
    phone_group: number | null;
    date_group: number | null;
    note_group: number | null;
    date_missing: boolean;
    test_result: ParsedSmsResult;
  } {
    const sms = exampleSms.trim();

    // Collect all tokens that exist in the example string
    interface TokenItem {
      field: "amount" | "ref" | "sender" | "phone" | "date" | "note";
      value: string;
      start: number;
      end: number;
      regexCapture: string;
    }

    const tokens: TokenItem[] = [];

    const addToken = (
      field: TokenItem["field"],
      val: string | number | null | undefined,
      capture: string
    ) => {
      if (!val) return;
      const strVal = String(val).trim();
      if (!strVal) return;
      const idx = sms.indexOf(strVal);
      if (idx !== -1) {
        tokens.push({
          field,
          value: strVal,
          start: idx,
          end: idx + strVal.length,
          regexCapture: capture,
        });
      }
    };

    // Add candidate tokens
    addToken("amount", extracted.amount, "([\\d,]+\\.?\\d*)");
    addToken("ref", extracted.transaction_ref, "([A-Za-z0-9/_\\-]+)");
    addToken("phone", extracted.sender_phone, "(\\+?\\d{9,15})");
    addToken("date", extracted.date, "(\\d{4}-\\d{2}-\\d{2}|\\d{2}[/-]\\d{2}[/-]\\d{4})");
    addToken("sender", extracted.sender_name, "([A-Za-z0-9\\s.,&'\\-]+?)");
    addToken("note", extracted.note, "([^.\\n\\r]+?)");

    // Sort tokens by start position in example string
    tokens.sort((a, b) => a.start - b.start);

    // Remove any overlapping tokens
    const nonOverlapping: TokenItem[] = [];
    let lastEnd = 0;
    for (const t of tokens) {
      if (t.start >= lastEnd) {
        nonOverlapping.push(t);
        lastEnd = t.end;
      }
    }

    // Build the regex string
    let pattern = "";
    let currentIndex = 0;
    const groupMap: Record<string, number> = {};

    nonOverlapping.forEach((t, i) => {
      const literalBefore = sms.slice(currentIndex, t.start);
      if (literalBefore.length > 0) {
        // Escape regex special chars and normalize spaces
        const escaped = literalBefore
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\s+/g, "\\s+");
        pattern += escaped;
      }
      pattern += t.regexCapture;
      groupMap[t.field] = i + 1;
      currentIndex = t.end;
    });

    // Remainder after last token (match up to punctuation or end)
    if (currentIndex < sms.length) {
      const literalAfter = sms.slice(currentIndex);
      // If short literal after, match it loosely
      const snippet = literalAfter.trim().slice(0, 30);
      if (snippet) {
        const escaped = snippet
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\s+/g, "\\s+");
        pattern += `.*?(?:${escaped})?`;
      }
    }

    // Verify pattern against exampleSms
    const regex = new RegExp(pattern, "i");
    const match = sms.match(regex);

    const amountGroup = groupMap["amount"] || null;
    const refGroup = groupMap["ref"] || null;
    const senderGroup = groupMap["sender"] || null;
    const phoneGroup = groupMap["phone"] || null;
    const dateGroup = groupMap["date"] || null;
    const noteGroup = groupMap["note"] || null;
    const dateMissing = !extracted.date || !dateGroup;

    const testResult: ParsedSmsResult = {
      provider: "OTHER",
      amount: amountGroup && match ? cleanAmount(match[amountGroup]) : null,
      transaction_ref: refGroup && match ? match[refGroup].trim() : null,
      sender_name: senderGroup && match ? match[senderGroup].trim() : null,
      sender_phone: phoneGroup && match ? match[phoneGroup].trim() : null,
      entry_date:
        dateGroup && match
          ? normalizeDate(match[dateGroup]).date
          : formatDateYYYYMMDD(new Date()),
      date_missing: dateMissing,
      note: noteGroup && match ? match[noteGroup].trim() : null,
      raw_message: sms,
      success: !!(match && (amountGroup ? match[amountGroup] : true)),
      pattern_name: "Auto-Generated Pattern",
    };

    return {
      pattern_regex: pattern,
      amount_group: amountGroup,
      ref_group: refGroup,
      sender_group: senderGroup,
      phone_group: phoneGroup,
      date_group: dateGroup,
      note_group: noteGroup,
      date_missing: dateMissing,
      test_result: testResult,
    };
  }

  /**
   * Test an arbitrary regex and group mapping on a given SMS string
   */
  static testPattern(
    text: string,
    regexStr: string,
    groupMap: {
      amount_group?: number | null;
      ref_group?: number | null;
      sender_group?: number | null;
      phone_group?: number | null;
      date_group?: number | null;
      note_group?: number | null;
      date_missing?: boolean;
      provider?: string;
    }
  ): ParsedSmsResult {
    try {
      const regex = new RegExp(regexStr, "i");
      const match = text.match(regex);
      if (!match) {
        return {
          provider: (groupMap.provider as any) || "UNKNOWN",
          amount: null,
          entry_date: formatDateYYYYMMDD(new Date()),
          date_missing: true,
          transaction_ref: null,
          sender_name: null,
          sender_phone: null,
          note: null,
          raw_message: text,
          success: false,
          pattern_name: "Pattern Did Not Match",
        };
      }

      let amount: number | null = null;
      if (groupMap.amount_group && match[groupMap.amount_group]) {
        amount = cleanAmount(match[groupMap.amount_group]);
      }

      let transactionRef: string | null = null;
      if (groupMap.ref_group && match[groupMap.ref_group]) {
        transactionRef = match[groupMap.ref_group].trim();
      }

      let senderName: string | null = null;
      if (groupMap.sender_group && match[groupMap.sender_group]) {
        senderName = match[groupMap.sender_group].trim().replace(/[.,;]+$/, "");
      }

      let senderPhone: string | null = null;
      if (groupMap.phone_group && match[groupMap.phone_group]) {
        senderPhone = match[groupMap.phone_group].trim();
      }

      let entryDate = formatDateYYYYMMDD(new Date());
      let dateMissing = groupMap.date_missing ?? true;
      if (groupMap.date_group && match[groupMap.date_group]) {
        const dateRes = normalizeDate(match[groupMap.date_group]);
        entryDate = dateRes.date;
        dateMissing = dateRes.isMissing;
      }

      let note: string | null = null;
      if (groupMap.note_group && match[groupMap.note_group]) {
        note = match[groupMap.note_group].trim();
      }

      return {
        provider: (groupMap.provider as any) || "OTHER",
        amount,
        entry_date: entryDate,
        date_missing: dateMissing,
        transaction_ref: transactionRef,
        sender_name: senderName,
        sender_phone: senderPhone,
        note,
        raw_message: text,
        success: !!(amount && transactionRef),
        pattern_name: "Test Result",
      };
    } catch (err: any) {
      return {
        provider: "UNKNOWN",
        amount: null,
        entry_date: formatDateYYYYMMDD(new Date()),
        date_missing: true,
        transaction_ref: null,
        sender_name: null,
        sender_phone: null,
        note: null,
        raw_message: text,
        success: false,
        pattern_name: `Regex Error: ${err.message}`,
      };
    }
  }
}
