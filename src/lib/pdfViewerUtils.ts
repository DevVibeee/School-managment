/**
 * PDF & Document Viewer Utilities for Unique School System
 * Handles conversion of base64 data URIs, storage URLs, and Blob objects into renderable URLs
 */

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'tiff', 'tif', 'heic', 'heif']);
const PDF_EXTS = new Set(['pdf']);

function detectExtFromApiProxyUrl(url: string): string {
  if (!url) return '';
  const lower = url.toLowerCase();

  if (lower.includes('/api/')) {
    const match = lower.match(/[?&]path=([^&]+)/i);
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1]);
        const m = decoded.match(/\.([a-zA-Z0-9]+)(?:[?#].*)?$/);
        if (m) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
      } catch {
        // ignore
      }
    }
  }
  return '';
}

export function getPDFViewerUrl(url: string | undefined | null, _recordInfo?: { rollNo?: string; studentName?: string; examName?: string }): string {
  if (!url) return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  // Real http(s) URLs — Supabase public storage, CDN, etc. (show actual PDF)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Relative API proxy paths
  if (trimmed.startsWith('/api/')) {
    return trimmed;
  }

  // Base64 PDF data URL → blob URL for inline viewing
  if (trimmed.startsWith('data:application/pdf') || trimmed.startsWith('data:pdf') || (trimmed.startsWith('data:') && trimmed.includes('pdf'))) {
    try {
      const parts = trimmed.split(',');
      if (parts.length > 1) {
        const base64Data = parts[1];
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      }
    } catch (e) {
      console.warn('Could not parse base64 PDF URL for blob creation, returning original string:', e);
      return trimmed;
    }
  }

  // Raw base64 string without data prefix
  if (!trimmed.startsWith('blob:') && trimmed.length > 100) {
    try {
      const binaryString = window.atob(trimmed);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch {
      // not base64 — fall through
    }
  }

  return trimmed;
}

/** Resolve the best viewable URL for an exam result (uploaded PDF, not placeholder HTML). */
export function resolveExamResultPdfUrl(result: {
  file_url?: string | null;
  storage_path?: string | null;
  student_roll?: string;
  student_name?: string;
  exam_name?: string;
  file_name?: string;
}): string {
  if (result.file_url) {
    const resolved = getPDFViewerUrl(result.file_url, {
      rollNo: result.student_roll || result.file_name,
      studentName: result.student_name,
      examName: result.exam_name
    });
    if (resolved) return resolved;
  }
  if (result.storage_path) {
    return `/api/supabase/file?path=${encodeURIComponent(result.storage_path)}`;
  }
  return '';
}

export function isPDFUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  const ext = detectExtFromApiProxyUrl(url);
  if (ext && PDF_EXTS.has(ext)) return true;
  if (ext && IMAGE_EXTS.has(ext)) return false;

  return (
    lower.startsWith('data:application/pdf') ||
    lower.startsWith('data:pdf') ||
    lower.includes('application/pdf') ||
    lower.includes('.pdf') ||
    (lower.startsWith('/api/supabase/file') && !ext) ||
    (lower.startsWith('data:') && lower.includes('pdf')) ||
    (!lower.startsWith('http') && !lower.startsWith('data:') && !lower.startsWith('/') && lower.length > 200)
  );
}

export function isImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  const ext = detectExtFromApiProxyUrl(url);
  if (ext) return IMAGE_EXTS.has(ext);

  return (
    lower.startsWith('data:image/') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.bmp') ||
    lower.endsWith('.tiff') ||
    lower.endsWith('.tif')
  );
}

export function examResultHasPdf(result: {
  file_url?: string | null;
  storage_path?: string | null;
}): boolean {
  if (result.storage_path) return true;
  if (!result.file_url) return false;
  return isPDFUrl(result.file_url);
}
