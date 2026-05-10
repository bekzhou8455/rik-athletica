// RIK Audit — PDF generation via puppeteer-core + @sparticuz/chromium.
// Renders the audit page (HTML) to PDF, uploads to Vercel Blob, returns public URL.

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { put } from '@vercel/blob';

// Vercel runtime: use Sparticuz chromium binary.
// Local dev: falls back to system Chrome if VERCEL_ENV is unset and CHROME_PATH is provided.
async function launchBrowser() {
  const isVercel = !!process.env.VERCEL_ENV;

  if (isVercel) {
    // Reduce required system libs (drops libnss3.so dependency on AL2023 runtime)
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;
    return puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  // Local dev: use a system-installed Chrome (set CHROME_PATH or use macOS default)
  const localChrome = process.env.CHROME_PATH
    ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: localChrome,
    headless: true,
  });
}

export async function renderHtmlToPdfBuffer(html) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '24mm', right: '18mm', bottom: '24mm', left: '18mm' },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

export async function uploadPdfToBlob({ buffer, slug }) {
  const filename = `audits/${slug}.pdf`;
  const result = await put(filename, buffer, {
    access: 'public',
    contentType: 'application/pdf',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return result.url;
}

export async function generateAndStorePdf({ html, slug }) {
  const buffer = await renderHtmlToPdfBuffer(html);
  return uploadPdfToBlob({ buffer, slug });
}
