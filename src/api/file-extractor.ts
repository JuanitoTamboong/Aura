// src/api/file-extractor.ts
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Set up PDF worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractTextFromFile(file: File): Promise<string> {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

  try {
    // ── TEXT / CSV / MD ──
    if (["txt", "csv", "md", "json"].includes(fileExt)) {
      return await file.text();
    }

    // ── MICROSOFT WORD (.docx) ──
    if (fileExt === "docx") {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }

    // ── MICROSOFT EXCEL (.xlsx) ──
    if (["xlsx", "xls"].includes(fileExt)) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      let fullText = "";
      
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        fullText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
      });
      return fullText;
    }

    // ── PDF (.pdf) ──
    if (fileExt === "pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // @ts-ignore
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += pageText + "\n";
      }
      return fullText;
    }

    return "";
  } catch (error) {
    console.error(`Failed to extract text from ${file.name}:`, error);
    return "";
  }
}