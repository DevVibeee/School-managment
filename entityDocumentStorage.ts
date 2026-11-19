/** Shared helpers for entity document gallery storage (client + server). */

export const ENTITY_DOCS_BUCKET = 'entity-documents';
export const CLOUDINARY_BUCKET = 'cloudinary';

export type GalleryDocRecord = {
  id?: string;
  title?: string;
  url?: string | null;
  uploaded_at?: string;
  notes?: string;
  storage_path?: string;
  storage_bucket?: string;
  storage_persisted?: boolean;
};

export function isRemoteDocumentUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('/api/supabase/file'))
  );
}

export function buildEntityDocStoragePath(
  entityType: 'students' | 'teachers',
  entityId: string,
  docId: string,
  ext: string
): string {
  const safeId = entityId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${entityType}/${safeId}/${safeDocId}.${ext}`;
}

export function buildEntityDocProxyUrl(
  storagePath: string,
  bucket = ENTITY_DOCS_BUCKET
): string {
  return `/api/supabase/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(storagePath)}`;
}

export function inferDocumentExt(dataUrlOrMime: string, fileName?: string): string {
  const fromName = fileName?.match(/\.([a-zA-Z0-9]+)$/);
  if (fromName) {
    const ext = fromName[1].toLowerCase();
    if (ext === 'jpeg') return 'jpg';
    return ext;
  }

  const mimeMatch = dataUrlOrMime.match(/^data:([^;]+);/);
  const mime = (mimeMatch?.[1] || dataUrlOrMime).toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('bmp')) return 'bmp';
  if (mime.includes('tiff') || mime.includes('tif')) return 'tiff';
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('heic') || mime.includes('heif')) return 'heic';
  if (mime.includes('msword') || mime.includes('application/word')) return 'doc';
  if (mime.includes('openxmlformats-officedocument.wordprocessingml')) return 'docx';
  if (mime.includes('excel') || mime.includes('spreadsheetml.sheet')) return 'xlsx';
  if (mime.includes('vnd.ms-excel')) return 'xls';
  if (mime.includes('powerpoint') || mime.includes('presentationml.presentation')) return 'pptx';
  if (mime.includes('vnd.ms-powerpoint')) return 'ppt';
  if (mime.includes('rtf')) return 'rtf';
  if (mime.includes('plain') || (mime.includes('text/') && !mime.includes('html') && !mime.includes('csv'))) return 'txt';
  if (mime.includes('csv')) return 'csv';
  if (mime.includes('html') || mime.includes('htm')) return 'html';
  if (mime.includes('zip') || mime.includes('compressed')) return 'zip';
  if (mime.includes('rar')) return 'rar';
  if (mime.includes('7z') || mime.includes('7-zip')) return '7z';
  if (mime.includes('tar')) return 'tar';
  if (mime.includes('gz') || mime.includes('gzip')) return 'gz';
  if (mime.includes('mp3') || (mime.includes('mpeg') && mime.includes('audio'))) return 'mp3';
  if (mime.includes('mp4') || mime.includes('video/mp4')) return 'mp4';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('avi')) return 'avi';
  if (mime.includes('mov') || mime.includes('quicktime')) return 'mov';
  if (mime.includes('json')) return 'json';
  if (mime.includes('xml')) return 'xml';
  if (mime.includes('vcard') || mime.includes('vcf')) return 'vcf';
  if (mime.includes('ics')) return 'ics';

  // Magic-byte detection (file signatures) — works on base64 data URLs or raw base64
  let base64Payload = '';
  const dataParts = dataUrlOrMime.match(/^data:[^;]+;base64,(.+)$/);
  if (dataParts && dataParts[1]) {
    base64Payload = dataParts[1];
  } else if (!dataUrlOrMime.startsWith('data:') && dataUrlOrMime.length > 20 && !dataUrlOrMime.includes('\n')) {
    base64Payload = dataUrlOrMime;
  }
  if (base64Payload) {
    try {
      const firstBytes: number[] = [];
      const toDecode = base64Payload.slice(0, 16);
      const binary = typeof atob === 'function' ? atob(toDecode) : Buffer.from(toDecode, 'base64').toString('binary');
      for (let i = 0; i < Math.min(12, binary.length); i++) firstBytes.push(binary.charCodeAt(i));
      const b = firstBytes;
      if (b.length >= 4) {
        // PDF: %PDF
        if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
        // PNG: 89 50 4E 47
        if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
        // GIF: GIF8
        if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';
        // JPEG: FF D8 FF
        if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
        // WEBP: RIFF + WEBP
        if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b.length >= 12 &&
            b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
        // BMP: BM
        if (b[0] === 0x42 && b[1] === 0x4D) return 'bmp';
        // ZIP / DOCX / XLSX / PPTX: PK\x03\x04
        if (b[0] === 0x50 && b[1] === 0x4B && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) && b[3] === 0x04) return 'zip';
        // RAR: Rar!
        if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) return 'rar';
        // GZIP: 1F 8B
        if (b[0] === 0x1F && b[1] === 0x8B) return 'gz';
        // TIFF LE: 49 49 2A 00
        if (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0x00) return 'tiff';
        // TIFF BE: 4D 4D 00 2A
        if (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2A) return 'tiff';
        // MP3: ID3 or FF FB
        if ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xFF && b[1] === 0xFB)) return 'mp3';
      }
    } catch {
      // ignore base64 parse errors
    }
  }

  return 'dat';
}

export function contentTypeFromExt(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, '');
  switch (e) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'svg': return 'image/svg+xml';
    case 'tiff': case 'tif': return 'image/tiff';
    case 'heic': return 'image/heic';
    case 'heif': return 'image/heif';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt': return 'application/vnd.ms-powerpoint';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'txt': return 'text/plain';
    case 'csv': return 'text/csv';
    case 'rtf': return 'application/rtf';
    case 'html': case 'htm': return 'text/html';
    case 'zip': return 'application/zip';
    case 'rar': return 'application/vnd.rar';
    case '7z': return 'application/x-7z-compressed';
    case 'tar': return 'application/x-tar';
    case 'gz': return 'application/gzip';
    case 'mp3': return 'audio/mpeg';
    case 'mp4': return 'video/mp4';
    case 'wav': return 'audio/wav';
    case 'avi': return 'video/x-msvideo';
    case 'mov': return 'video/quicktime';
    case 'json': return 'application/json';
    case 'xml': return 'application/xml';
    case 'vcf': return 'text/vcard';
    case 'ics': return 'text/calendar';
    case 'dat': return 'application/octet-stream';
    default: return 'application/octet-stream';
  }
}

export function extractExtFromUrl(url: string): string {
  if (!url) return '';
  const lower = url.toLowerCase();

  // Check inline storage path query param first for proxy URLs
  if (lower.includes('/api/supabase/file') || lower.includes('/api/')) {
    try {
      const u = new URL(url, typeof location !== 'undefined' ? location.origin : 'http://localhost');
      const p = u.searchParams.get('path') || u.searchParams.get('storage_path');
      if (p) {
        const m = p.match(/\.([a-zA-Z0-9]+)(?:[?#].*)?$/);
        if (m) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
      }
      const rawSearch = u.search || '';
      const rawMatch = rawSearch.match(/[?&]path=([^&]+)/i);
      if (rawMatch) {
        const decoded = decodeURIComponent(rawMatch[1]);
        const m = decoded.match(/\.([a-zA-Z0-9]+)$/);
        if (m) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
      }
    } catch {
      // ignore URL parse errors
    }
  }

  // Regular URL or path
  const pathPart = lower.split('?')[0].split('#')[0];
  const m = pathPart.match(/\.([a-zA-Z0-9]+)$/);
  if (m) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  return '';
}

export function suggestFileNameFromUrl(url: string, fallbackTitle = 'document'): string {
  const ext = extractExtFromUrl(url);
  const safeTitle = fallbackTitle.replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';
  if (ext) return `${safeTitle}.${ext}`;
  return safeTitle;
}

/** Replace oversized data URLs with persisted remote URLs when storage is confirmed. */
export function normalizeGalleryDocForStore(doc: GalleryDocRecord): GalleryDocRecord {
  if (doc.storage_bucket === CLOUDINARY_BUCKET && isRemoteDocumentUrl(doc.url)) {
    return { ...doc, storage_persisted: doc.storage_persisted ?? true };
  }

  const bucket = doc.storage_bucket || ENTITY_DOCS_BUCKET;

  if (doc.storage_path && doc.storage_persisted !== false) {
    if (isRemoteDocumentUrl(doc.url)) return doc;
    const url = doc.url;
    if (!url || typeof url !== 'string' || url.startsWith('data:') || url.length > 4000) {
      return {
        ...doc,
        url: buildEntityDocProxyUrl(doc.storage_path, bucket)
      };
    }
    return doc;
  }

  if (typeof doc.url === 'string' && doc.url.startsWith('data:') && doc.url.length > 4000) {
    return { ...doc, url: null };
  }

  return doc;
}

export async function uploadEntityDocumentViaApi(
  entityType: 'students' | 'teachers',
  entityId: string,
  docId: string,
  fileBase64: string,
  fileName?: string
): Promise<{
  url: string;
  storage_path: string;
  storage_bucket: string;
  storagePersisted: boolean;
}> {
  const ext = inferDocumentExt(fileBase64, fileName);
  const storagePath = buildEntityDocStoragePath(entityType, entityId, docId, ext);
  const bucket = ENTITY_DOCS_BUCKET;

  const res = await fetch('/api/supabase/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path: storagePath, fileBase64 })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Document upload failed.');
  }

  const data = await res.json();
  const persisted =
    data.cloudPersisted === true ||
    data.storagePersisted === true ||
    data.dbPersisted === true;

  if (persisted && data.publicUrl) {
    const resolvedBucket =
      data.bucket === CLOUDINARY_BUCKET || String(data.publicUrl).includes('res.cloudinary.com')
        ? CLOUDINARY_BUCKET
        : (data.bucket || ENTITY_DOCS_BUCKET);
    const url =
      String(data.publicUrl).startsWith('http')
        ? String(data.publicUrl)
        : buildEntityDocProxyUrl(String(data.path || storagePath), resolvedBucket);

    return {
      url,
      storage_path: String(data.path || storagePath),
      storage_bucket: resolvedBucket,
      storagePersisted: true
    };
  }

  throw new Error(data.error || 'Document could not be saved.');
}
