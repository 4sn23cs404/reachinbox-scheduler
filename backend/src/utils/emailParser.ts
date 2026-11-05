import Papa from 'papaparse';

export interface ParseEmailResult {
  totalRecords: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  validEmails: string[];
  invalidEmails: string[];
  preview: string[]; // First 10 valid emails
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254 || trimmed.length < 5) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Extracts and parses email addresses from CSV or TXT file contents.
 */
export function parseRecipientsFile(fileBuffer: Buffer, fileName: string): ParseEmailResult {
  const fileContent = fileBuffer.toString('utf-8').trim();
  const isTxt = fileName.toLowerCase().endsWith('.txt');

  const rawEntries: string[] = [];

  if (isTxt) {
    // Split by newlines or commas
    const lines = fileContent.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.split(/[,\t]/);
      for (const part of parts) {
        const cleaned = part.trim();
        if (cleaned) {
          rawEntries.push(cleaned);
        }
      }
    }
  } else {
    // Parse as CSV using PapaParse
    const parsed = Papa.parse<any>(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.data && parsed.data.length > 0) {
      // Find the email column header if present
      const firstRow = parsed.data[0];
      const headers = Object.keys(firstRow);
      const emailHeader = headers.find((h) =>
        /email|recipient|mail|address/i.test(h.trim())
      );

      for (const row of parsed.data) {
        if (emailHeader && row[emailHeader]) {
          rawEntries.push(String(row[emailHeader]).trim());
        } else {
          // Check all values in the row for an email pattern
          for (const key of Object.keys(row)) {
            const val = String(row[key] || '').trim();
            if (val.includes('@')) {
              rawEntries.push(val);
              break;
            }
          }
        }
      }
    } else {
      // Fallback: parse raw CSV lines without headers
      const unheadered = Papa.parse<string[]>(fileContent, {
        header: false,
        skipEmptyLines: true,
      });

      for (const row of unheadered.data) {
        if (Array.isArray(row)) {
          for (const cell of row) {
            const cellVal = String(cell || '').trim();
            if (cellVal.includes('@')) {
              rawEntries.push(cellVal);
              break;
            }
          }
        }
      }
    }
  }

  // Deduplication and validation
  const seen = new Set<string>();
  const validEmails: string[] = [];
  const invalidEmails: string[] = [];
  let duplicateCount = 0;

  for (const entry of rawEntries) {
    const cleaned = entry.trim().toLowerCase();
    if (!cleaned) continue;

    if (isValidEmail(cleaned)) {
      if (seen.has(cleaned)) {
        duplicateCount++;
      } else {
        seen.add(cleaned);
        validEmails.push(cleaned);
      }
    } else {
      invalidEmails.push(entry);
    }
  }

  return {
    totalRecords: rawEntries.length,
    validCount: validEmails.length,
    invalidCount: invalidEmails.length,
    duplicateCount,
    validEmails,
    invalidEmails: invalidEmails.slice(0, 50), // Sample for review
    preview: validEmails.slice(0, 10),
  };
}
