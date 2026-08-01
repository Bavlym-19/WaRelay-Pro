import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text: string }>;

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

interface ParsedContact {
  name: string;
  phone: string;
  plotNumber: string;
  area: string;
  district: string;
  neighborhood: string;
}

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function normalizeEgyptianPhone(value: string): string | null {
  let digits = normalizeDigits(value).replace(/\D/g, "");

  if (digits.startsWith("0020")) digits = digits.slice(2);
  if (digits.startsWith("20") && digits.length === 12) digits = `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;

  return /^01\d{9}$/.test(digits) ? digits : null;
}

function cleanCell(value: string, reverseArabic = false): string {
  const cleaned = value
    .replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return reverseArabic ? [...cleaned].reverse().join("").replace(/\s+/g, " ").trim() : cleaned;
}

function parsePdfTablePages(text: string): ParsedContact[] {
  const items: PdfTextItem[] = [];
  for (const line of text.split("\n")) {
    try {
      const pageItems = JSON.parse(line) as Array<{ str?: string; x?: number; y?: number }>;
      if (!Array.isArray(pageItems)) continue;
      for (const item of pageItems) {
        if (typeof item.str === "string" && typeof item.x === "number" && typeof item.y === "number") {
          items.push({ str: item.str, x: item.x, y: item.y });
        }
      }
    } catch {
      // This is the normal text parser's output, not structured page data.
    }
  }
  if (items.length === 0) return [];

  const rows = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    const rowY = Math.round(item.y / 2) * 2;
    const row = rows.get(rowY) ?? [];
    row.push(item);
    rows.set(rowY, row);
  }

  const contacts: ParsedContact[] = [];
  for (const row of rows.values()) {
    const cells = { name: "", plotNumber: "", area: "", neighborhood: "", district: "", phone: "" };
    for (const item of row) {
      if (item.x >= 480) cells.phone += item.str;
      else if (item.x >= 430) cells.district += item.str;
      else if (item.x >= 370) cells.neighborhood += item.str;
      else if (item.x >= 330) cells.plotNumber += item.str;
      else if (item.x >= 235) cells.name += item.str;
    }

    const phone = normalizeEgyptianPhone(cells.phone);
    const name = cleanCell(cells.name, true);
    if (!phone || !name || name.length < 3 || name === "Name") continue;

    contacts.push({
      name,
      phone,
      plotNumber: cleanCell(cells.plotNumber) || "1",
      district: cleanCell(cells.district) || "35",
      neighborhood: cleanCell(cells.neighborhood, true) || "4",
      area: "",
    });
  }
  return contacts;
}

function parsePdfContacts(text: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const lines = normalizeDigits(text)
    .replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    // Skip header lines
    if (line.includes("Name") && line.includes("Number")) continue;
    if (line === "Name" || line === "Number") continue;

    // PDFs exported from Egyptian spreadsheets often drop the leading zero,
    // e.g. 1008091649 means 01008091649.
    const phoneCandidates = line.match(/(?:\+?20|0020)?(?:01\d{9}|1\d{9})/g) ?? [];
    const phone = phoneCandidates
      .map(normalizeEgyptianPhone)
      .find((candidate): candidate is string => candidate !== null);
    if (!phone) continue;

    // Remove phone from line before extracting other numbers
    const withoutPhone = line
      .replace(phone, "")
      .replace(phone.slice(1), "")
      .replace(`20${phone.slice(1)}`, "")
      .trim();

    // Extract Arabic name (Arabic Unicode range)
    const arabicMatch = withoutPhone.match(/[\u0600-\u06FF\s\u0621-\u064A]+/);
    const name = arabicMatch ? arabicMatch[0].trim().replace(/\s+/g, " ") : "";
    if (!name || name.length < 3) continue;

    // Extract remaining numbers (plot info) — these are short numbers NOT the phone
    // Format: Name  blockNum  district  neighborhood  plotId  276  349140
    // We want: plotId=index 3 (4th number), district=index 1, neighborhood=index 2
    const nums = [...withoutPhone.matchAll(/\b(\d{1,6})\b/g)].map((m) => m[1]);

    const plotNumber = nums[3] ?? nums[0] ?? "1";
    const district = nums[1] ?? "35";
    const neighborhood = nums[2] ?? "4";

    contacts.push({ name, phone, plotNumber, district, neighborhood, area: "" });
  }

  return contacts;
}

router.post("/parse-pdf", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "لم يتم رفع ملف" });
    return;
  }

  try {
    const data = await pdfParse(req.file.buffer, {
      pagerender: async (pageData: {
        getTextContent: (options?: Record<string, unknown>) => Promise<{
          items: Array<{ str?: string; transform?: number[] }>;
        }>;
      }) => {
        const content = await pageData.getTextContent({ normalizeWhitespace: false });
        return JSON.stringify(content.items.map((item) => ({
          str: item.str ?? "",
          x: item.transform?.[4] ?? 0,
          y: item.transform?.[5] ?? 0,
        })));
      },
    });
    const contacts = parsePdfTablePages(data.text);
    const parsedContacts = contacts.length > 0 ? contacts : parsePdfContacts(data.text);

    if (parsedContacts.length === 0) {
      res.status(422).json({
        error: "لم يتم العثور على بيانات. تأكد أن الملف يحتوي على أرقام هاتف مصرية (01xxxxxxxxx)",
        rawText: data.text.slice(0, 500),
      });
      return;
    }

    res.json({ contacts: parsedContacts, total: parsedContacts.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `خطأ في قراءة الملف: ${msg}` });
  }
});

export default router;
