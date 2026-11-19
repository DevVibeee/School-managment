var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// entityDocumentBlobStore.ts
var entityDocumentBlobStore_exports = {};
__export(entityDocumentBlobStore_exports, {
  entityBlobKey: () => entityBlobKey,
  loadEntityDocumentBlob: () => loadEntityDocumentBlob,
  loadEntityDocumentBlobAuto: () => loadEntityDocumentBlobAuto,
  persistEntityDocumentBlob: () => persistEntityDocumentBlob,
  registerEntityDocumentDbResolver: () => registerEntityDocumentDbResolver
});
function registerEntityDocumentDbResolver(fn) {
  dbResolver = fn;
}
async function resolveDb() {
  if (!dbResolver) return null;
  try {
    return await dbResolver();
  } catch {
    return null;
  }
}
function entityBlobKey(bucket, storagePath) {
  return `${bucket}/${storagePath}`;
}
async function persistEntityDocumentBlob(db, bucket, storagePath, buffer, contentType) {
  if (!db) return false;
  try {
    const id = entityBlobKey(bucket, storagePath);
    await db.collection(COLLECTION).updateOne(
      { id },
      {
        $set: {
          id,
          bucket,
          storage_path: storagePath,
          content_type: contentType,
          content_base64: buffer.toString("base64"),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      },
      { upsert: true }
    );
    return true;
  } catch {
    return false;
  }
}
async function loadEntityDocumentBlob(db, bucket, storagePath) {
  if (!db) return { ok: false };
  try {
    const doc = await db.collection(COLLECTION).findOne({
      id: entityBlobKey(bucket, storagePath)
    });
    if (!doc?.content_base64) return { ok: false };
    return {
      ok: true,
      buffer: Buffer.from(String(doc.content_base64), "base64"),
      contentType: String(doc.content_type || "application/octet-stream")
    };
  } catch {
    return { ok: false };
  }
}
async function loadEntityDocumentBlobAuto(bucket, storagePath) {
  const db = await resolveDb();
  return loadEntityDocumentBlob(db, bucket, storagePath);
}
var COLLECTION, dbResolver;
var init_entityDocumentBlobStore = __esm({
  "entityDocumentBlobStore.ts"() {
    COLLECTION = "entity_document_blobs";
    dbResolver = null;
  }
});

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");

// brevoEmail.ts
var import_nodemailer = __toESM(require("nodemailer"), 1);
function env(key) {
  const raw = process.env[key];
  if (!raw) return "";
  return raw.replace(/^["']|["']$/g, "").trim();
}
function getEmailConfig() {
  const smtpUser = env("SMTP_USER");
  const smtpPass = env("SMTP_PASS");
  const brevoApiKey = env("BREVO_API_KEY");
  const fromEmail = env("SMTP_FROM_EMAIL") || "uschools.pk@gmail.com";
  const fromName = env("SMTP_FROM_NAME") || "Unique School System";
  const host = env("SMTP_HOST") || "smtp-relay.brevo.com";
  const port = parseInt(env("SMTP_PORT") || "587", 10);
  return {
    fromEmail,
    fromName,
    host,
    port,
    smtpConfigured: Boolean(smtpUser && smtpPass),
    apiConfigured: Boolean(brevoApiKey),
    configured: Boolean(smtpUser && smtpPass || brevoApiKey),
    smtpUser: smtpUser ? `${smtpUser.slice(0, 6)}\u2026` : "",
    hasFromEmail: Boolean(fromEmail && fromEmail.includes("@"))
  };
}
function createSmtpTransporter() {
  const cfg = getEmailConfig();
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  if (!user || !pass) return null;
  return import_nodemailer.default.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    requireTLS: cfg.port === 587,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" }
  });
}
function isDeliverableAddress(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e.includes("@")) return false;
  if (e.includes("example.com")) return false;
  return true;
}
async function sendViaBrevoApi(options) {
  const apiKey = env("BREVO_API_KEY");
  if (!apiKey) {
    return { status: "Failed", error: "BREVO_API_KEY not configured" };
  }
  const body = {
    sender: { name: options.fromName, email: options.fromEmail },
    to: [{ email: options.to }],
    subject: options.subject,
    htmlContent: options.html,
    textContent: options.text || void 0
  };
  if (options.attachments?.length) {
    body.attachment = options.attachments.map((att) => ({
      name: att.filename,
      content: att.encoding === "base64" ? att.content : Buffer.from(att.content).toString("base64")
    }));
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    return { status: "Success", channel: "brevo-api" };
  }
  let detail = `HTTP ${res.status}`;
  try {
    const json = await res.json();
    detail = json?.message || json?.code || detail;
  } catch {
    detail = `${detail}: ${(await res.text()).slice(0, 200)}`;
  }
  return { status: "Failed", channel: "brevo-api", error: detail };
}
async function sendViaSmtp(options) {
  const transporter = createSmtpTransporter();
  if (!transporter) {
    return { status: "Failed", error: "SMTP_USER/SMTP_PASS not configured" };
  }
  try {
    await transporter.sendMail({
      from: `"${options.fromName}" <${options.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        encoding: att.encoding || "base64"
      }))
    });
    return { status: "Success", channel: "smtp" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "Failed", channel: "smtp", error: message };
  }
}
async function sendTransactionalEmail(options) {
  const cfg = getEmailConfig();
  if (!isDeliverableAddress(options.to)) {
    return {
      status: "Simulated",
      error: `Non-deliverable or test address: ${options.to}`
    };
  }
  if (!cfg.configured) {
    return {
      status: "Simulated",
      error: "Email not configured \u2014 set BREVO_API_KEY and/or SMTP_USER+SMTP_PASS on Render"
    };
  }
  if (cfg.apiConfigured) {
    const apiResult = await sendViaBrevoApi({
      ...options,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName
    });
    if (apiResult.status === "Success") return apiResult;
    console.warn("[Email] Brevo API failed, trying SMTP fallback:", apiResult.error);
  }
  if (cfg.smtpConfigured) {
    const smtpResult = await sendViaSmtp({
      ...options,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName
    });
    if (smtpResult.status === "Success") return smtpResult;
    console.error("[Email] SMTP failed:", smtpResult.error);
    return smtpResult;
  }
  return {
    status: "Failed",
    error: cfg.apiConfigured ? "Brevo API and SMTP both failed" : "No SMTP credentials after API failure"
  };
}
async function verifyEmailConnectivity() {
  const config = getEmailConfig();
  if (!config.configured) {
    return {
      ok: false,
      config,
      hint: "Set BREVO_API_KEY (recommended on Render) and SMTP_FROM_EMAIL in Render Environment variables."
    };
  }
  let smtpVerify;
  if (config.smtpConfigured) {
    try {
      const t = createSmtpTransporter();
      await t?.verify();
      smtpVerify = "ok";
    } catch (err) {
      smtpVerify = err instanceof Error ? err.message : String(err);
    }
  }
  let apiReachable;
  if (config.apiConfigured) {
    try {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": env("BREVO_API_KEY"), Accept: "application/json" }
      });
      apiReachable = res.ok;
    } catch {
      apiReachable = false;
    }
  }
  const ok = Boolean(apiReachable || smtpVerify === "ok");
  return {
    ok,
    config,
    smtpVerify,
    apiReachable,
    hint: ok ? void 0 : "Verify BREVO_API_KEY and that SMTP_FROM_EMAIL is a verified sender in Brevo dashboard."
  };
}

// server.ts
var import_mongodb = require("mongodb");

// entityDocumentStorage.ts
var ENTITY_DOCS_BUCKET = "entity-documents";
var CLOUDINARY_BUCKET = "cloudinary";
function isRemoteDocumentUrl(value) {
  return typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://") || value.startsWith("/api/supabase/file"));
}
function buildEntityDocStoragePath(entityType, entityId, docId, ext) {
  const safeId = entityId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${entityType}/${safeId}/${safeDocId}.${ext}`;
}
function buildEntityDocProxyUrl(storagePath, bucket = ENTITY_DOCS_BUCKET) {
  return `/api/supabase/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(storagePath)}`;
}
function inferDocumentExt(dataUrlOrMime, fileName) {
  const fromName = fileName?.match(/\.([a-zA-Z0-9]+)$/);
  if (fromName) {
    const ext = fromName[1].toLowerCase();
    if (ext === "jpeg") return "jpg";
    return ext;
  }
  const mimeMatch = dataUrlOrMime.match(/^data:([^;]+);/);
  const mime = (mimeMatch?.[1] || dataUrlOrMime).toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("bmp")) return "bmp";
  if (mime.includes("tiff") || mime.includes("tif")) return "tiff";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("msword") || mime.includes("application/word")) return "doc";
  if (mime.includes("openxmlformats-officedocument.wordprocessingml")) return "docx";
  if (mime.includes("excel") || mime.includes("spreadsheetml.sheet")) return "xlsx";
  if (mime.includes("vnd.ms-excel")) return "xls";
  if (mime.includes("powerpoint") || mime.includes("presentationml.presentation")) return "pptx";
  if (mime.includes("vnd.ms-powerpoint")) return "ppt";
  if (mime.includes("rtf")) return "rtf";
  if (mime.includes("plain") || mime.includes("text/") && !mime.includes("html") && !mime.includes("csv")) return "txt";
  if (mime.includes("csv")) return "csv";
  if (mime.includes("html") || mime.includes("htm")) return "html";
  if (mime.includes("zip") || mime.includes("compressed")) return "zip";
  if (mime.includes("rar")) return "rar";
  if (mime.includes("7z") || mime.includes("7-zip")) return "7z";
  if (mime.includes("tar")) return "tar";
  if (mime.includes("gz") || mime.includes("gzip")) return "gz";
  if (mime.includes("mp3") || mime.includes("mpeg") && mime.includes("audio")) return "mp3";
  if (mime.includes("mp4") || mime.includes("video/mp4")) return "mp4";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("avi")) return "avi";
  if (mime.includes("mov") || mime.includes("quicktime")) return "mov";
  if (mime.includes("json")) return "json";
  if (mime.includes("xml")) return "xml";
  if (mime.includes("vcard") || mime.includes("vcf")) return "vcf";
  if (mime.includes("ics")) return "ics";
  let base64Payload = "";
  const dataParts = dataUrlOrMime.match(/^data:[^;]+;base64,(.+)$/);
  if (dataParts && dataParts[1]) {
    base64Payload = dataParts[1];
  } else if (!dataUrlOrMime.startsWith("data:") && dataUrlOrMime.length > 20 && !dataUrlOrMime.includes("\n")) {
    base64Payload = dataUrlOrMime;
  }
  if (base64Payload) {
    try {
      const firstBytes = [];
      const toDecode = base64Payload.slice(0, 16);
      const binary = typeof atob === "function" ? atob(toDecode) : Buffer.from(toDecode, "base64").toString("binary");
      for (let i = 0; i < Math.min(12, binary.length); i++) firstBytes.push(binary.charCodeAt(i));
      const b = firstBytes;
      if (b.length >= 4) {
        if (b[0] === 37 && b[1] === 80 && b[2] === 68 && b[3] === 70) return "pdf";
        if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) return "png";
        if (b[0] === 71 && b[1] === 73 && b[2] === 70 && b[3] === 56) return "gif";
        if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "jpg";
        if (b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b.length >= 12 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80) return "webp";
        if (b[0] === 66 && b[1] === 77) return "bmp";
        if (b[0] === 80 && b[1] === 75 && (b[2] === 3 || b[2] === 5 || b[2] === 7) && b[3] === 4) return "zip";
        if (b[0] === 82 && b[1] === 97 && b[2] === 114 && b[3] === 33) return "rar";
        if (b[0] === 31 && b[1] === 139) return "gz";
        if (b[0] === 73 && b[1] === 73 && b[2] === 42 && b[3] === 0) return "tiff";
        if (b[0] === 77 && b[1] === 77 && b[2] === 0 && b[3] === 42) return "tiff";
        if (b[0] === 73 && b[1] === 68 && b[2] === 51 || b[0] === 255 && b[1] === 251) return "mp3";
      }
    } catch {
    }
  }
  return "dat";
}
function contentTypeFromExt(ext) {
  const e = ext.toLowerCase().replace(/^\./, "");
  switch (e) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    case "tiff":
    case "tif":
      return "image/tiff";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "rtf":
      return "application/rtf";
    case "html":
    case "htm":
      return "text/html";
    case "zip":
      return "application/zip";
    case "rar":
      return "application/vnd.rar";
    case "7z":
      return "application/x-7z-compressed";
    case "tar":
      return "application/x-tar";
    case "gz":
      return "application/gzip";
    case "mp3":
      return "audio/mpeg";
    case "mp4":
      return "video/mp4";
    case "wav":
      return "audio/wav";
    case "avi":
      return "video/x-msvideo";
    case "mov":
      return "video/quicktime";
    case "json":
      return "application/json";
    case "xml":
      return "application/xml";
    case "vcf":
      return "text/vcard";
    case "ics":
      return "text/calendar";
    case "dat":
      return "application/octet-stream";
    default:
      return "application/octet-stream";
  }
}
function normalizeGalleryDocForStore(doc) {
  if (doc.storage_bucket === CLOUDINARY_BUCKET && isRemoteDocumentUrl(doc.url)) {
    return { ...doc, storage_persisted: doc.storage_persisted ?? true };
  }
  const bucket = doc.storage_bucket || ENTITY_DOCS_BUCKET;
  if (doc.storage_path && doc.storage_persisted !== false) {
    if (isRemoteDocumentUrl(doc.url)) return doc;
    const url = doc.url;
    if (!url || typeof url !== "string" || url.startsWith("data:") || url.length > 4e3) {
      return {
        ...doc,
        url: buildEntityDocProxyUrl(doc.storage_path, bucket)
      };
    }
    return doc;
  }
  if (typeof doc.url === "string" && doc.url.startsWith("data:") && doc.url.length > 4e3) {
    return { ...doc, url: null };
  }
  return doc;
}

// entityDocumentMerge.ts
var STUDENT_DOC_URL_FIELDS = [
  "profile_image_url",
  "b_form_doc",
  "father_cnic_doc",
  "death_certificate_doc",
  "leaving_cert_doc"
];
var TEACHER_DOC_URL_FIELDS = [
  "profile_image_url",
  "cnic_doc",
  "degree_doc",
  "work_exp_doc"
];
function isUsableDocUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (value.startsWith("/api/supabase/file")) return true;
  if (value.startsWith("http://") || value.startsWith("https://")) return true;
  if (value.startsWith("data:") && value.length <= 4e3) return true;
  return false;
}
function galleryDocKey(doc) {
  return String(doc.id || doc.storage_path || doc.url || "");
}
function galleryDocScore(doc) {
  let score = 0;
  if (doc.storage_path) score += 4;
  if (doc.storage_persisted !== false) score += 2;
  if (typeof doc.url === "string" && doc.url.startsWith("/api/supabase/file")) score += 3;
  if (typeof doc.url === "string" && doc.url.startsWith("https://res.cloudinary.com")) score += 4;
  if (typeof doc.url === "string" && doc.url && !doc.url.startsWith("data:")) score += 1;
  return score;
}
function mergeGalleryDocuments(...sources) {
  const map = /* @__PURE__ */ new Map();
  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw) continue;
      const doc = normalizeGalleryDocForStore(raw);
      const key = galleryDocKey(doc);
      if (!key) continue;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, doc);
        continue;
      }
      const winner = galleryDocScore(doc) >= galleryDocScore(prev) ? doc : prev;
      const loser = winner === doc ? prev : doc;
      map.set(key, normalizeGalleryDocForStore({ ...loser, ...winner }));
    }
  }
  return Array.from(map.values()).filter((doc) => doc.url || doc.storage_path);
}
function coerceDateField(value, fallback) {
  const fb = fallback && String(fallback).trim() && String(fallback).toLowerCase() !== "n/a" ? coerceDateField(fallback) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (value === null || value === void 0) return fb;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "n/a" || s.toLowerCase() === "na") return fb;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return fb;
}
function normalizeMergedDateFields(merged) {
  if ("roll_no" in merged || "class_name" in merged) {
    if ("enrollment_date" in merged) merged.enrollment_date = coerceDateField(merged.enrollment_date);
    if ("dob" in merged) merged.dob = coerceDateField(merged.dob, String(merged.enrollment_date || ""));
  } else if ("designation" in merged || "teacher_id" in merged) {
    if ("joining_date" in merged) merged.joining_date = coerceDateField(merged.joining_date);
    if ("dob" in merged) merged.dob = coerceDateField(merged.dob, String(merged.joining_date || ""));
  }
}
function docFieldsForRecord(row) {
  return row.teacher_id !== void 0 || row.designation !== void 0 ? TEACHER_DOC_URL_FIELDS : STUDENT_DOC_URL_FIELDS;
}
function mergeRecordDocuments(base, overlay) {
  const merged = { ...base, ...overlay };
  const docFields = docFieldsForRecord(merged);
  const baseGallery = Array.isArray(base.document_gallery) ? base.document_gallery : [];
  const overlayGallery = Array.isArray(overlay.document_gallery) ? overlay.document_gallery : [];
  const gallery = mergeGalleryDocuments(baseGallery, overlayGallery);
  if (gallery.length > 0) {
    merged.document_gallery = gallery;
  } else if (!Array.isArray(merged.document_gallery)) {
    merged.document_gallery = [];
  }
  for (const key of docFields) {
    const overlayVal = overlay[key];
    const baseVal = base[key];
    if (isUsableDocUrl(overlayVal)) merged[key] = overlayVal;
    else if (isUsableDocUrl(baseVal)) merged[key] = baseVal;
  }
  const baseCustom = base.custom_fields && typeof base.custom_fields === "object" && !Array.isArray(base.custom_fields) ? base.custom_fields : {};
  const overlayCustom = overlay.custom_fields && typeof overlay.custom_fields === "object" && !Array.isArray(overlay.custom_fields) ? overlay.custom_fields : {};
  if (Object.keys(baseCustom).length || Object.keys(overlayCustom).length) {
    const nextCustom = { ...baseCustom, ...overlayCustom };
    for (const key of /* @__PURE__ */ new Set([...Object.keys(baseCustom), ...Object.keys(overlayCustom)])) {
      const overlayVal = overlayCustom[key];
      const baseVal = baseCustom[key];
      if (isUsableDocUrl(overlayVal)) nextCustom[key] = overlayVal;
      else if (isUsableDocUrl(baseVal)) nextCustom[key] = baseVal;
    }
    merged.custom_fields = nextCustom;
  }
  normalizeMergedDateFields(merged);
  return merged;
}
function mergeEntityListsWithDocuments(...sources) {
  const map = /* @__PURE__ */ new Map();
  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      map.set(item.id, prev ? mergeRecordDocuments(prev, item) : item);
    }
  }
  return Array.from(map.values());
}

// dbSyncHelpers.ts
function mergeRecordsById(...sources) {
  const map = /* @__PURE__ */ new Map();
  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      map.set(item.id, prev ? { ...prev, ...item } : item);
    }
  }
  return Array.from(map.values());
}
function mergePreferLatest(...sources) {
  const map = /* @__PURE__ */ new Map();
  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item?.id) continue;
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}
function mergeEntityListForFetch(tableRows, storeSnapshot) {
  if (!Array.isArray(storeSnapshot)) return tableRows;
  const storeRows = storeSnapshot;
  if (storeRows.length === 0) return tableRows;
  const storeIds = new Set(storeRows.map((r) => r.id));
  const tableById = new Map(tableRows.map((r) => [r.id, r]));
  const maxStoreCreated = Math.max(0, ...storeRows.map(entityCreatedAtMs));
  const merged = storeRows.map((row) => {
    const fromTable = tableById.get(row.id);
    return fromTable ? mergeRecordDocuments(fromTable, row) : row;
  });
  for (const row of tableRows) {
    if (!storeIds.has(row.id) && entityCreatedAtMs(row) >= maxStoreCreated) {
      merged.push(row);
    }
  }
  return merged;
}
function entityCreatedAtMs(record) {
  const parsed = Date.parse(record.created_at || "");
  if (Number.isFinite(parsed)) return parsed;
  const idMatch = String(record.id || "").match(/(\d{10,13})/);
  if (idMatch) {
    const n = Number(idMatch[1]);
    return idMatch[1].length === 13 ? n : n * 1e3;
  }
  return 0;
}
function resolveEntityListForStoreWrite(stored, incoming) {
  if (!Array.isArray(stored) || stored.length === 0) return incoming;
  if (!Array.isArray(incoming) || incoming.length === 0) return incoming;
  const storedArr = stored;
  const storedIds = new Set(storedArr.map((row) => row.id));
  const incomingIds = new Set(incoming.map((row) => row.id));
  const maxIncomingCreated = Math.max(0, ...incoming.map(entityCreatedAtMs));
  const maxStoredCreated = Math.max(0, ...storedArr.map(entityCreatedAtMs));
  const isStrictSubset = incoming.length < storedArr.length && incoming.every((row) => storedIds.has(row.id));
  if (isStrictSubset) {
    const missingFromIncoming = storedArr.filter((s) => !incomingIds.has(s.id));
    const newerMissing = missingFromIncoming.filter(
      (m) => entityCreatedAtMs(m) > maxIncomingCreated
    );
    if (newerMissing.length > 0) {
      console.warn(
        `[DB_SYNC] Preserving ${newerMissing.length} newer record(s) from stale subset list \u2014 client newest=${maxIncomingCreated}, preservedNewest=${Math.max(0, ...newerMissing.map(entityCreatedAtMs))}`
      );
      return [...incoming, ...newerMissing];
    }
    const sameBatchMissing = missingFromIncoming.filter(
      (m) => entityCreatedAtMs(m) === maxStoredCreated && maxStoredCreated === maxIncomingCreated
    );
    if (sameBatchMissing.length > 0 && missingFromIncoming.length === sameBatchMissing.length) {
      return [...incoming, ...sameBatchMissing];
    }
    return incoming;
  }
  if (incoming.length > storedArr.length && storedArr.every((row) => incomingIds.has(row.id))) {
    const incomingById = new Map(incoming.map((row) => [row.id, row]));
    const merged = storedArr.map((row) => ({
      ...row,
      ...incomingById.get(row.id)
    }));
    for (const row of incoming) {
      if (!storedIds.has(row.id)) {
        merged.push(row);
      }
    }
    return merged;
  }
  return incoming;
}
function resolveSchoolFeeSettingsForStoreWrite(stored, incoming) {
  if (!incoming || typeof incoming !== "object") {
    return stored && typeof stored === "object" ? stored : null;
  }
  const inc = incoming;
  if (!stored || typeof stored !== "object") return inc;
  const st = stored;
  const inAt = Date.parse(String(inc.updated_at || ""));
  const stAt = Date.parse(String(st.updated_at || ""));
  if (Number.isFinite(stAt) && (!Number.isFinite(inAt) || inAt < stAt)) {
    return st;
  }
  return { ...st, ...inc };
}
var FEE_TABLE_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "student_id",
  "month",
  "year",
  "tuition_fee",
  "lab_charges",
  "custom_charges",
  "discount",
  "discount_scholarship",
  "net_fee",
  "paid_amount",
  "status",
  "due_date",
  "payment_date",
  "installments",
  "scheduled_installments",
  "payment_plan",
  "fee_category",
  "remarks",
  "voucher_sent_at",
  "custom_fields",
  "created_at"
]);
function normalizeFeeForDb(fee) {
  const row = {};
  for (const key of FEE_TABLE_COLUMNS) {
    if (fee[key] !== void 0) row[key] = fee[key];
  }
  if (row.installments === void 0) row.installments = [];
  if (row.scheduled_installments === void 0 && fee.scheduled_installments !== void 0) {
    row.scheduled_installments = fee.scheduled_installments;
  }
  if (row.custom_fields === void 0) row.custom_fields = fee.custom_fields ?? {};
  if (row.due_date !== void 0) row.due_date = normalizeOptionalDateForDb(row.due_date);
  if (row.payment_date !== void 0) row.payment_date = normalizeOptionalDateForDb(row.payment_date);
  return row;
}
function normalizeFeesForDb(fees) {
  if (!Array.isArray(fees)) return [];
  return fees.filter((f) => Boolean(f && typeof f === "object" && f.id)).map(normalizeFeeForDb);
}
var EXAM_RESULTS_TABLE_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "student_id",
  "created_at",
  "student_roll",
  "student_name",
  "session_name",
  "exam_category",
  "exam_name",
  "evaluation_type",
  "year",
  "month",
  "month_name",
  "week_number",
  "term_name",
  "subject",
  "subject_name",
  "marks",
  "obtained_marks",
  "marks_obtained",
  "total_marks",
  "percentage",
  "grade",
  "status",
  "remarks",
  "teacher_comments",
  "file_name",
  "file_url",
  "storage_path",
  "uploaded_at"
]);
function normalizeExamResultForDb(result) {
  const src = stripOversizedFields({ ...result });
  if (!src.exam_category && src.exam_type) src.exam_category = src.exam_type;
  if (!src.session_name && src.session) src.session_name = src.session;
  if (src.obtained_marks === void 0 && src.marks_obtained !== void 0) {
    src.obtained_marks = src.marks_obtained;
  }
  if (src.marks_obtained === void 0 && src.obtained_marks !== void 0) {
    src.marks_obtained = src.obtained_marks;
  }
  const row = {};
  for (const key of EXAM_RESULTS_TABLE_COLUMNS) {
    if (src[key] !== void 0) row[key] = src[key];
  }
  if (!row.created_at) row.created_at = (/* @__PURE__ */ new Date()).toISOString();
  return row;
}
function normalizeExamResultsForDb(results) {
  if (!Array.isArray(results)) return [];
  return results.filter((r) => Boolean(r && typeof r === "object" && r.id)).map(normalizeExamResultForDb);
}
function resolveExamResultsForDbSync(examResults, students) {
  const studentList = Array.isArray(students) ? students : [];
  const byId = /* @__PURE__ */ new Set();
  const byRoll = /* @__PURE__ */ new Map();
  for (const s of studentList) {
    if (!s || typeof s !== "object") continue;
    const row = s;
    if (row.id) byId.add(String(row.id));
    const roll = String(row.roll_no || "").trim().toLowerCase();
    if (roll) byRoll.set(roll, String(row.id));
  }
  const normalized = normalizeExamResultsForDb(examResults);
  const forTable = [];
  for (const row of normalized) {
    let studentId = String(row.student_id || "").trim();
    if (!studentId || studentId === "unmatched" || !byId.has(studentId)) {
      const roll = String(row.student_roll || "").trim().toLowerCase();
      const resolved = roll ? byRoll.get(roll) : void 0;
      if (resolved) {
        row.student_id = resolved;
        studentId = resolved;
      }
    }
    if (studentId && byId.has(studentId)) {
      forTable.push(row);
    }
  }
  return forTable;
}
var EXPENSES_TABLE_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "date",
  "category",
  "amount",
  "description",
  "payment_mode",
  "logged_by",
  "receipt_url",
  "created_at",
  "custom_fields"
]);
function normalizeExpenseForDb(expense) {
  const src = stripOversizedFields({ ...expense });
  if (!src.date && src.expense_date) src.date = src.expense_date;
  if (!src.description && src.title) src.description = src.title;
  const row = {};
  for (const key of EXPENSES_TABLE_COLUMNS) {
    if (src[key] !== void 0) row[key] = src[key];
  }
  row.date = normalizeDateForDb(row.date);
  row.category = withDefaultString(row.category, "General");
  row.amount = typeof row.amount === "number" ? row.amount : Number(row.amount) || 0;
  row.description = withDefaultString(row.description, "Expense");
  row.payment_mode = withDefaultString(row.payment_mode, "Cash");
  row.logged_by = withDefaultString(row.logged_by, "System");
  row.custom_fields = row.custom_fields ?? {};
  if (!row.created_at) row.created_at = (/* @__PURE__ */ new Date()).toISOString();
  return row;
}
function normalizeExpensesForDb(expenses) {
  if (!Array.isArray(expenses)) return [];
  return expenses.filter((e) => Boolean(e && typeof e === "object" && e.id)).map(normalizeExpenseForDb);
}
function collectIds(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => item && typeof item === "object" ? item.id : void 0).filter((id) => Boolean(id));
}
var NA = "N/A";
var MAX_SYNC_FIELD_CHARS = 4e3;
var STUDENTS_TABLE_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "roll_no",
  "full_name",
  "dob",
  "b_form_no",
  "gender",
  "blood_group",
  "father_name",
  "father_cnic",
  "mother_name",
  "parent_phone",
  "emergency_phone",
  "mailing_address",
  "enrollment_date",
  "class_name",
  "guardian_name",
  "guardian_relation",
  "guardian_cnic",
  "guardian_phone",
  "guardian_email",
  "guardian_profession",
  "guardian_income_source",
  "is_orphan",
  "donor_id",
  "donor_name",
  "donor_number",
  "donor_email",
  "father_profession_before_death",
  "cause_of_death",
  "standard_tuition_fee",
  "discount_amount",
  "discount_reason",
  "payment_plan",
  "profile_image_url",
  "b_form_doc",
  "father_cnic_doc",
  "death_certificate_doc",
  "leaving_cert_doc",
  "noc_status",
  "document_gallery",
  "custom_fields",
  "created_at",
  "updated_at"
]);
var TEACHERS_TABLE_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "teacher_id",
  "full_name",
  "cnic",
  "phone",
  "alt_phone",
  "email",
  "address",
  "qualification",
  "specialization",
  "joining_date",
  "dob",
  "base_salary",
  "designation",
  "classes_assigned",
  "subjects_assigned",
  "profile_image_url",
  "cnic_doc",
  "degree_doc",
  "work_exp_doc",
  "document_gallery",
  "custom_fields",
  "created_at",
  "updated_at"
]);
function pickTableColumns(row, columns) {
  const out = {};
  for (const key of columns) {
    if (row[key] !== void 0) out[key] = row[key];
  }
  return out;
}
function stripOversizedFields(row) {
  const out = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string" && value.length > MAX_SYNC_FIELD_CHARS) {
      if (value.startsWith("/api/supabase/file")) continue;
      if (value.startsWith("data:") || key.endsWith("_doc") || key.endsWith("_url")) {
        out[key] = value.startsWith("http") ? value.slice(0, MAX_SYNC_FIELD_CHARS) : null;
      }
    }
  }
  if (out.custom_fields && typeof out.custom_fields === "object" && !Array.isArray(out.custom_fields)) {
    const cf = { ...out.custom_fields };
    for (const [cfKey, cfVal] of Object.entries(cf)) {
      if (typeof cfVal === "string" && cfVal.length > MAX_SYNC_FIELD_CHARS) {
        if (cfVal.startsWith("/api/supabase/file")) continue;
        if (cfVal.startsWith("data:")) cf[cfKey] = null;
      }
    }
    out.custom_fields = cf;
  }
  if (Array.isArray(out.document_gallery)) {
    out.document_gallery = out.document_gallery.map((doc) => normalizeGalleryDocForStore(doc)).filter((doc) => doc.url || doc.storage_path);
  }
  return out;
}
function withDefaultString(value, fallback = NA) {
  if (value === null || value === void 0) return fallback;
  const s = String(value).trim();
  return s || fallback;
}
function isInvalidDateToken(value) {
  const s = value.trim().toLowerCase();
  return !s || s === "n/a" || s === "na" || s === "null" || s === "undefined" || s === "-";
}
function todayIsoDate() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function normalizeDateForDb(value, fallback) {
  const fb = fallback !== void 0 && !isInvalidDateToken(String(fallback)) ? normalizeDateForDb(fallback) : todayIsoDate();
  if (value === null || value === void 0) return fb;
  const s = String(value).trim();
  if (isInvalidDateToken(s)) return fb;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const isoPrefix = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return fb;
}
function normalizeOptionalDateForDb(value) {
  if (value === null || value === void 0) return null;
  const s = String(value).trim();
  if (isInvalidDateToken(s)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}
function normalizeTeacherCnic(value, teacherId) {
  if (value === null || value === void 0) {
    return `PENDING-${teacherId}`;
  }
  const s = String(value).trim();
  if (!s || s === NA || s.toUpperCase() === "N/A") {
    return `PENDING-${teacherId}`;
  }
  return s;
}
function normalizeStudentForDb(student) {
  const row = stripOversizedFields({ ...student });
  row.full_name = withDefaultString(row.full_name, "Unnamed Student");
  row.roll_no = withDefaultString(row.roll_no, `STU-${String(row.id || Date.now())}`);
  row.father_name = withDefaultString(row.father_name, withDefaultString(row.guardian_name));
  row.father_cnic = withDefaultString(row.father_cnic, withDefaultString(row.guardian_cnic));
  row.mother_name = withDefaultString(row.mother_name);
  row.b_form_no = withDefaultString(row.b_form_no);
  row.gender = withDefaultString(row.gender, "Other");
  row.blood_group = withDefaultString(row.blood_group);
  row.parent_phone = withDefaultString(row.parent_phone, withDefaultString(row.guardian_phone));
  row.emergency_phone = withDefaultString(row.emergency_phone, withDefaultString(row.parent_phone));
  row.mailing_address = withDefaultString(row.mailing_address);
  row.enrollment_date = normalizeDateForDb(row.enrollment_date);
  row.class_name = withDefaultString(row.class_name, "Unassigned");
  row.guardian_name = withDefaultString(row.guardian_name, withDefaultString(row.father_name));
  row.guardian_relation = withDefaultString(row.guardian_relation, "Guardian");
  row.guardian_cnic = withDefaultString(row.guardian_cnic, withDefaultString(row.father_cnic));
  row.guardian_phone = withDefaultString(row.guardian_phone, withDefaultString(row.parent_phone));
  row.guardian_email = withDefaultString(row.guardian_email);
  row.dob = normalizeDateForDb(row.dob, String(row.enrollment_date));
  row.is_orphan = row.is_orphan ?? false;
  row.custom_fields = row.custom_fields ?? {};
  row.document_gallery = row.document_gallery ?? [];
  row.noc_status = withDefaultString(row.noc_status, "Pending");
  row.guardian_profession = withDefaultString(row.guardian_profession);
  row.guardian_income_source = withDefaultString(row.guardian_income_source);
  row.discount_reason = withDefaultString(row.discount_reason, "Standard");
  row.payment_plan = withDefaultString(row.payment_plan, "Full");
  row.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  row.created_at = withDefaultString(row.created_at, (/* @__PURE__ */ new Date()).toISOString());
  return pickTableColumns(row, STUDENTS_TABLE_COLUMNS);
}
function normalizeStudentsForDb(students) {
  if (!Array.isArray(students)) return [];
  return students.filter((s) => Boolean(s && typeof s === "object" && s.id)).map(normalizeStudentForDb);
}
function normalizeTeacherForDb(teacher) {
  const row = stripOversizedFields({ ...teacher });
  row.full_name = withDefaultString(row.full_name, "Unnamed Teacher");
  row.teacher_id = withDefaultString(row.teacher_id, `T-${String(row.id || Date.now())}`);
  row.cnic = normalizeTeacherCnic(row.cnic, String(row.id || row.teacher_id || Date.now()));
  row.phone = withDefaultString(row.phone);
  row.alt_phone = withDefaultString(row.alt_phone, withDefaultString(row.phone));
  row.email = withDefaultString(row.email);
  row.address = withDefaultString(row.address);
  row.qualification = withDefaultString(row.qualification);
  row.specialization = withDefaultString(row.specialization);
  row.joining_date = normalizeDateForDb(row.joining_date);
  row.base_salary = typeof row.base_salary === "number" ? row.base_salary : Number(row.base_salary) || 0;
  row.designation = withDefaultString(row.designation, "Teacher");
  row.classes_assigned = withDefaultString(row.classes_assigned);
  row.subjects_assigned = withDefaultString(row.subjects_assigned);
  row.dob = normalizeDateForDb(row.dob, String(row.joining_date));
  row.custom_fields = row.custom_fields ?? {};
  row.document_gallery = row.document_gallery ?? [];
  row.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  row.created_at = withDefaultString(row.created_at, (/* @__PURE__ */ new Date()).toISOString());
  return pickTableColumns(row, TEACHERS_TABLE_COLUMNS);
}
function normalizeTeachersForDb(teachers) {
  if (!Array.isArray(teachers)) return [];
  const normalized = teachers.filter((t) => Boolean(t && typeof t === "object" && t.id)).map(normalizeTeacherForDb);
  return resolveTeachersCnicInList(normalized);
}
function resolveTeachersCnicInList(teachers) {
  const cnicToId = /* @__PURE__ */ new Map();
  const sorted = [...teachers].sort((a, b) => entityCreatedAtMs(a) - entityCreatedAtMs(b));
  const resolvedById = /* @__PURE__ */ new Map();
  for (const teacher of sorted) {
    const id = String(teacher.id || "");
    let cnic = typeof teacher.cnic === "string" ? teacher.cnic.trim() : "";
    if (!cnic || cnic.startsWith("PENDING-")) {
      resolvedById.set(id, teacher);
      continue;
    }
    const ownerId = cnicToId.get(cnic);
    if (ownerId && ownerId !== id) {
      resolvedById.set(id, { ...teacher, cnic: `PENDING-${id}` });
    } else {
      cnicToId.set(cnic, id);
      resolvedById.set(id, teacher);
    }
  }
  return teachers.map((teacher) => resolvedById.get(String(teacher.id)) ?? teacher);
}
function resolveTeachersCnicForUpsert(rows, existingRows = []) {
  const cnicToId = /* @__PURE__ */ new Map();
  for (const teacher of existingRows) {
    const id = String(teacher.id || "");
    const cnic = typeof teacher.cnic === "string" ? teacher.cnic.trim() : "";
    if (cnic && id && !cnic.startsWith("PENDING-")) {
      cnicToId.set(cnic, id);
    }
  }
  return rows.map((row) => {
    const id = String(row.id || "");
    let cnic = typeof row.cnic === "string" ? row.cnic.trim() : "";
    if (!cnic || cnic.startsWith("PENDING-")) return row;
    const dbOwnerId = cnicToId.get(cnic);
    if (dbOwnerId && dbOwnerId === id) return row;
    if (dbOwnerId && dbOwnerId !== id) {
      return { ...row, cnic: `PENDING-${id}` };
    }
    const batchOwnerId = cnicToId.get(cnic);
    if (batchOwnerId && batchOwnerId !== id) {
      return { ...row, cnic: `PENDING-${id}` };
    }
    cnicToId.set(cnic, id);
    return row;
  });
}
function isDuplicateCnicError(error) {
  const msg = String(error?.message || error).toLowerCase();
  const code = String(error?.code || "");
  return msg.includes("teachers_cnic") && (code === "23505" || msg.includes("duplicate key"));
}
var EMAIL_TEMPLATES_TABLE_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "type",
  "name",
  "subject",
  "header_title",
  "body",
  "footer",
  "accent_color",
  "is_active",
  "updated_at"
]);
var EMAIL_TEMPLATE_TYPES = /* @__PURE__ */ new Set([
  "fee_reminder",
  "salary_slip",
  "teacher_profile",
  "report_card",
  "sponsor_update",
  "custom"
]);
function normalizeEmailTemplateForDb(template) {
  const src = { ...template };
  if (!src.updated_at && src.created_at) src.updated_at = src.created_at;
  const row = {};
  for (const key of EMAIL_TEMPLATES_TABLE_COLUMNS) {
    if (src[key] !== void 0) row[key] = src[key];
  }
  const rawType = withDefaultString(row.type, "custom");
  row.type = EMAIL_TEMPLATE_TYPES.has(rawType) ? rawType : "custom";
  row.name = withDefaultString(row.name, "Template");
  row.subject = withDefaultString(row.subject, "Notification");
  row.body = withDefaultString(row.body, "");
  row.header_title = withDefaultString(row.header_title, row.name);
  row.footer = withDefaultString(row.footer, "");
  row.accent_color = withDefaultString(row.accent_color, "#1e3a8a");
  row.updated_at = withDefaultString(row.updated_at, (/* @__PURE__ */ new Date()).toISOString());
  if (row.is_active === void 0) row.is_active = true;
  return row;
}
function normalizeEmailTemplatesForDb(templates) {
  if (!Array.isArray(templates)) return [];
  return templates.filter((t) => Boolean(t && typeof t === "object" && t.id)).map(normalizeEmailTemplateForDb);
}
var STUDENT_ATTENDANCE_TABLE_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "date",
  "class_name",
  "student_id",
  "status",
  "hl_reason",
  "created_at"
]);
function normalizeStudentAttendanceForDb(record) {
  const row = {};
  for (const key of STUDENT_ATTENDANCE_TABLE_COLUMNS) {
    if (record[key] !== void 0) row[key] = record[key];
  }
  row.date = normalizeDateForDb(row.date);
  row.class_name = withDefaultString(row.class_name, "Unassigned");
  row.student_id = String(row.student_id || "").trim();
  row.status = withDefaultString(row.status, "P");
  if (!row.created_at) row.created_at = (/* @__PURE__ */ new Date()).toISOString();
  return row;
}
function resolveStudentAttendanceForDbSync(records, students, dbStudentIds) {
  const byId = /* @__PURE__ */ new Set();
  for (const s of Array.isArray(students) ? students : []) {
    if (!s || typeof s !== "object") continue;
    const id = s.id;
    if (id) byId.add(String(id));
  }
  const normalized = normalizeStudentAttendanceListForDb(records);
  return normalized.filter((row) => {
    const studentId = String(row.student_id || "").trim();
    if (!studentId || studentId === "unknown" || !byId.has(studentId)) return false;
    if (dbStudentIds && dbStudentIds.size > 0 && !dbStudentIds.has(studentId)) return false;
    return true;
  });
}
function normalizeStudentAttendanceListForDb(records) {
  if (!Array.isArray(records)) return [];
  const normalized = records.filter((r) => Boolean(r && typeof r === "object" && r.id)).map(normalizeStudentAttendanceForDb);
  const byKey = /* @__PURE__ */ new Map();
  for (const row of normalized) {
    byKey.set(`${row.date}|${row.student_id}|${row.class_name}`, row);
  }
  return Array.from(byKey.values());
}
var TEACHER_ATTENDANCE_TABLE_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "date",
  "teacher_id",
  "status",
  "hl_reason",
  "created_at"
]);
function normalizeTeacherAttendanceForDb(record) {
  const row = {};
  for (const key of TEACHER_ATTENDANCE_TABLE_COLUMNS) {
    if (record[key] !== void 0) row[key] = record[key];
  }
  row.date = normalizeDateForDb(row.date);
  row.teacher_id = String(row.teacher_id || "").trim();
  row.status = withDefaultString(row.status, "P");
  if (!row.created_at) row.created_at = (/* @__PURE__ */ new Date()).toISOString();
  return row;
}
function resolveTeacherAttendanceForDbSync(records, teachers, dbTeacherIds) {
  const byId = /* @__PURE__ */ new Set();
  for (const t of Array.isArray(teachers) ? teachers : []) {
    if (!t || typeof t !== "object") continue;
    const id = t.id;
    if (id) byId.add(String(id));
  }
  const normalized = normalizeTeacherAttendanceListForDb(records);
  return normalized.filter((row) => {
    const teacherId = String(row.teacher_id || "").trim();
    if (!teacherId || teacherId === "unknown" || !byId.has(teacherId)) return false;
    if (dbTeacherIds && dbTeacherIds.size > 0 && !dbTeacherIds.has(teacherId)) return false;
    return true;
  });
}
function normalizeTeacherAttendanceListForDb(records) {
  if (!Array.isArray(records)) return [];
  const normalized = records.filter((r) => Boolean(r && typeof r === "object" && r.id)).map(normalizeTeacherAttendanceForDb);
  const byKey = /* @__PURE__ */ new Map();
  for (const row of normalized) {
    byKey.set(`${row.date}|${row.teacher_id}`, row);
  }
  return Array.from(byKey.values());
}
var PAYROLL_TABLE_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "teacher_id",
  "month",
  "year",
  "month_start_date",
  "total_working_days",
  "daily_salary",
  "half_day_deduction",
  "base_salary",
  "present_count",
  "absent_count",
  "half_leave_count",
  "hl_count",
  "leave_count",
  "absent_deduction",
  "hl_deduction",
  "deductions",
  "bonus",
  "bonus_reason",
  "net_salary",
  "status",
  "disbursed_date",
  "payment_mode",
  "remarks",
  "created_at"
]);
function normalizePayrollForDb(payroll) {
  const row = {};
  for (const key of PAYROLL_TABLE_COLUMNS) {
    if (payroll[key] !== void 0) row[key] = payroll[key];
  }
  row.teacher_id = withDefaultString(row.teacher_id, "unknown");
  row.month = withDefaultString(row.month, "January");
  row.year = typeof row.year === "number" ? row.year : Number(row.year) || (/* @__PURE__ */ new Date()).getFullYear();
  row.total_working_days = typeof row.total_working_days === "number" ? row.total_working_days : Number(row.total_working_days) || 26;
  row.daily_salary = typeof row.daily_salary === "number" ? row.daily_salary : Number(row.daily_salary) || 0;
  row.half_day_deduction = typeof row.half_day_deduction === "number" ? row.half_day_deduction : Number(row.half_day_deduction) || 0;
  row.base_salary = typeof row.base_salary === "number" ? row.base_salary : Number(row.base_salary) || 0;
  row.net_salary = typeof row.net_salary === "number" ? row.net_salary : Number(row.net_salary) || Number(row.base_salary) || 0;
  row.deductions = typeof row.deductions === "number" ? row.deductions : Number(row.deductions) || 0;
  row.absent_deduction = typeof row.absent_deduction === "number" ? row.absent_deduction : Number(row.absent_deduction) || 0;
  row.hl_deduction = typeof row.hl_deduction === "number" ? row.hl_deduction : Number(row.hl_deduction) || 0;
  row.absent_count = typeof row.absent_count === "number" ? row.absent_count : Number(row.absent_count) || 0;
  row.hl_count = typeof row.hl_count === "number" ? row.hl_count : Number(row.hl_count) || 0;
  row.bonus = typeof row.bonus === "number" ? row.bonus : Number(row.bonus) || 0;
  row.status = withDefaultString(row.status, "Pending");
  if (row.month_start_date !== void 0) {
    row.month_start_date = normalizeOptionalDateForDb(row.month_start_date);
  }
  if (row.disbursed_date !== void 0) {
    row.disbursed_date = normalizeOptionalDateForDb(row.disbursed_date);
  }
  if (!row.created_at) row.created_at = (/* @__PURE__ */ new Date()).toISOString();
  return row;
}
function normalizePayrollsForDb(payrolls) {
  if (!Array.isArray(payrolls)) return [];
  return payrolls.filter((p) => Boolean(p && typeof p === "object" && p.id)).map(normalizePayrollForDb);
}
function stripEntityListForStore(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    return normalizeStoreDateFields(stripOversizedFields(item));
  });
}
function normalizeStoreDateFields(row) {
  const out = { ...row };
  if ("roll_no" in out || "class_name" in out) {
    if ("enrollment_date" in out) out.enrollment_date = normalizeDateForDb(out.enrollment_date);
    if ("dob" in out) out.dob = normalizeDateForDb(out.dob, String(out.enrollment_date || ""));
  } else if ("teacher_id" in out || "designation" in out) {
    if ("joining_date" in out) out.joining_date = normalizeDateForDb(out.joining_date);
    if ("dob" in out) out.dob = normalizeDateForDb(out.dob, String(out.joining_date || ""));
  } else if ("date" in out) {
    out.date = normalizeDateForDb(out.date);
  }
  return out;
}

// cloudinaryStorage.ts
var import_cloudinary = require("cloudinary");
function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}
function getCloudinaryConfig() {
  const cloud_name = readEnv("CLOUDINARY_CLOUD_NAME") || readEnv("Product_Environment") || readEnv("CLOUDINARY_CLOUDNAME");
  const api_key = readEnv("CLOUDINARY_API_KEY") || readEnv("API_Key") || readEnv("CLOUDINARY_KEY");
  const api_secret = readEnv("CLOUDINARY_API_SECRET") || readEnv("CLOUDINARY_SECRET") || readEnv("secret");
  const upload_preset = readEnv("CLOUDINARY_UPLOAD_PRESET") || readEnv("Key_Name") || readEnv("CLOUDINARY_PRESET");
  return { cloud_name, api_key, api_secret, upload_preset };
}
function isCloudinaryConfigured() {
  const { cloud_name, api_key, api_secret, upload_preset } = getCloudinaryConfig();
  return Boolean(cloud_name && (api_key && api_secret || upload_preset));
}
function configureCloudinary() {
  const cloudinaryUrl = readEnv("CLOUDINARY_URL");
  if (cloudinaryUrl) {
    import_cloudinary.v2.config({ cloudinary_url: cloudinaryUrl, secure: true });
    return true;
  }
  const { cloud_name, api_key, api_secret } = getCloudinaryConfig();
  if (!cloud_name || !api_key || !api_secret) return false;
  import_cloudinary.v2.config({ cloud_name, api_key, api_secret, secure: true });
  return true;
}
function folderAndPublicId(storagePath) {
  const normalized = storagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const lastSlash = normalized.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const dir = lastSlash >= 0 ? normalized.slice(0, lastSlash) : "misc";
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase() : "";
  const baseName = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName;
  const resourceType = ext === "pdf" || ext === "bin" ? "raw" : "image";
  return {
    folder: `unique-school/${dir}`,
    publicId: baseName,
    resourceType
  };
}
async function uploadUnsignedToCloudinary(buffer, storagePath, contentType) {
  const { cloud_name, upload_preset } = getCloudinaryConfig();
  if (!cloud_name || !upload_preset) {
    return { ok: false, error: "Cloudinary upload preset is not configured." };
  }
  import_cloudinary.v2.config({ cloud_name, secure: true });
  const { folder, publicId, resourceType } = folderAndPublicId(storagePath);
  const isPdf = resourceType === "raw" || storagePath.toLowerCase().endsWith(".pdf") || contentType.includes("pdf");
  const type = isPdf ? "raw" : "image";
  const mime = contentType || (isPdf ? "application/pdf" : "image/png");
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
  try {
    const uniquePublicId = `${publicId}-${Date.now()}`;
    const result = await import_cloudinary.v2.uploader.upload(dataUri, {
      upload_preset,
      unsigned: true,
      folder,
      public_id: uniquePublicId,
      resource_type: type
    });
    return {
      ok: true,
      secureUrl: result.secure_url,
      publicId: result.public_id
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Cloudinary unsigned upload failed."
    };
  }
}
async function uploadSignedToCloudinary(buffer, storagePath, contentType) {
  if (!configureCloudinary()) {
    return { ok: false, error: "Cloudinary signed credentials are not configured." };
  }
  const { folder, publicId, resourceType } = folderAndPublicId(storagePath);
  const isPdf = resourceType === "raw" || storagePath.toLowerCase().endsWith(".pdf") || contentType.includes("pdf");
  const type = isPdf ? "raw" : "image";
  const mime = contentType || (isPdf ? "application/pdf" : "image/jpeg");
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
  try {
    const result = await import_cloudinary.v2.uploader.upload(dataUri, {
      folder,
      public_id: publicId,
      resource_type: type,
      overwrite: true,
      type: "upload"
    });
    return {
      ok: true,
      secureUrl: result.secure_url,
      publicId: result.public_id
    };
  } catch (err) {
    const cloudErr = err;
    const message = cloudErr.message || "Cloudinary signed upload failed.";
    return { ok: false, error: message };
  }
}
async function uploadBufferToCloudinary(buffer, storagePath, contentType) {
  const { upload_preset, api_key, api_secret } = getCloudinaryConfig();
  if (upload_preset) {
    const unsigned = await uploadUnsignedToCloudinary(buffer, storagePath, contentType);
    if (unsigned.ok) return unsigned;
  }
  if (api_key && api_secret) {
    return uploadSignedToCloudinary(buffer, storagePath, contentType);
  }
  return { ok: false, error: "Cloudinary is not configured." };
}
function buildCloudinaryDeliveryUrl(publicId, resourceType = "image") {
  const { cloud_name } = getCloudinaryConfig();
  if (!cloud_name || !publicId) return null;
  if (configureCloudinary()) {
    try {
      return import_cloudinary.v2.url(publicId, {
        secure: true,
        resource_type: resourceType
      });
    } catch {
    }
  }
  const type = resourceType === "raw" ? "raw/upload" : "image/upload";
  return `https://res.cloudinary.com/${cloud_name}/${type}/${publicId}`;
}

// supabaseFailover.ts
var import_supabase_js = require("@supabase/supabase-js");
var import_ws = __toESM(require("ws"), 1);
var APP_STORE_ENTITY_LIST_KEYS = /* @__PURE__ */ new Set([
  "students",
  "teachers",
  "fees",
  "payrolls",
  "exam_results",
  "expenses",
  "email_templates",
  "custom_fields",
  "student_attendance",
  "teacher_attendance",
  "email_logs"
]);
var FETCH_TIMEOUT_MS = 45e3;
var UPSERT_CHUNK_SIZE = 15;
var MAX_RETRIES = 3;
var skipWarningAt = /* @__PURE__ */ new Map();
function logSkippedRows(table, skipped, reason) {
  const key = `${table}:${reason}`;
  const now = Date.now();
  const last = skipWarningAt.get(key) ?? 0;
  if (now - last < 6e4) return;
  skipWarningAt.set(key, now);
  console.warn(`[Supabase] ${table}: ${skipped} row(s) skipped \u2014 ${reason}`);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var clientOptions = {
  realtime: {
    transport: import_ws.default
  },
  global: {
    fetch: (input, init) => {
      const signal = init?.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
      return fetch(input, { ...init, signal });
    }
  }
};
var SUPABASE_PRIMARY_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
var SUPABASE_PRIMARY_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
var SUPABASE_OVERFLOW_URL = process.env.SUPABASE_OVERFLOW_URL || "";
var SUPABASE_OVERFLOW_KEY = process.env.SUPABASE_OVERFLOW_ANON_KEY || "";
var supabasePrimary = (0, import_supabase_js.createClient)(
  SUPABASE_PRIMARY_URL,
  SUPABASE_PRIMARY_KEY,
  clientOptions
);
var supabaseOverflow = (0, import_supabase_js.createClient)(
  SUPABASE_OVERFLOW_URL,
  SUPABASE_OVERFLOW_KEY,
  clientOptions
);
var supabase = supabasePrimary;
var primaryStorageFull = false;
var failoverActivatedAt = null;
function isStorageQuotaError(error) {
  if (!error) return false;
  const err = error;
  const msg = String(err.message || error).toLowerCase();
  const details = String(err.details || "").toLowerCase();
  const hint = String(err.hint || "").toLowerCase();
  const combined = `${msg} ${details} ${hint}`;
  const status = Number(err.status || err.statusCode || 0);
  return status === 507 || combined.includes("storage") || combined.includes("quota") || combined.includes("disk full") || combined.includes("insufficient") || combined.includes("exceed") || combined.includes("space") || combined.includes("capacity") || combined.includes("limit reached") || combined.includes("payload too large");
}
function isPostgresConstraintError(error) {
  if (!error) return false;
  const msg = String(error?.message || error).toLowerCase();
  const code = String(error?.code || "");
  return code === "23502" || code === "23503" || code === "23505" || msg.includes("violates not-null") || msg.includes("violates foreign-key") || msg.includes("duplicate key");
}
function isTransientNetworkError(error) {
  if (!error) return false;
  const msg = String(error?.message || error).toLowerCase();
  const name = String(error?.name || "").toLowerCase();
  return name === "aborterror" || msg.includes("fetch failed") || msg.includes("network") || msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("timeout") || msg.includes("socket hang up") || msg.includes("enotfound") || msg.includes("eai_again") || msg.includes("connection");
}
function markPrimaryStorageFull() {
  if (!primaryStorageFull) {
    primaryStorageFull = true;
    failoverActivatedAt = (/* @__PURE__ */ new Date()).toISOString();
    console.warn(
      "[Supabase Failover] Primary database storage is full. New saves will automatically go to the overflow Supabase. All existing primary data is preserved."
    );
  }
}
function getSupabaseFailoverStatus() {
  return {
    primaryStorageFull,
    failoverActivatedAt,
    primaryUrl: SUPABASE_PRIMARY_URL,
    overflowUrl: SUPABASE_OVERFLOW_URL,
    activeWriteTarget: primaryStorageFull ? "overflow" : "primary"
  };
}
async function checkSupabaseConnectivity() {
  let primary = false;
  let overflow = false;
  try {
    const { error } = await supabasePrimary.from("app_store").select("key").limit(1);
    primary = !error;
  } catch {
    primary = false;
  }
  try {
    const { error } = await supabaseOverflow.from("app_store").select("key").limit(1);
    overflow = !error;
  } catch {
    overflow = false;
  }
  return { primary, overflow };
}
async function selectMergedTable(table) {
  let primaryRows = [];
  let overflowRows = [];
  let primaryOk = false;
  let overflowOk = false;
  try {
    const { data, error } = await supabasePrimary.from(table).select("*");
    if (!error) {
      primaryOk = true;
      primaryRows = data || [];
    }
  } catch {
  }
  try {
    const { data, error } = await supabaseOverflow.from(table).select("*");
    if (!error) {
      overflowOk = true;
      overflowRows = data || [];
    }
  } catch {
  }
  return {
    data: primaryStorageFull ? overflowOk ? overflowRows : primaryRows : primaryOk ? primaryRows : mergeRecordsById(primaryRows, overflowRows),
    primaryOk,
    overflowOk
  };
}
async function loadMergedAppStoreMap() {
  const map = {};
  const meta = {};
  const ingest = (rows, isOverflow) => {
    if (!rows) return;
    for (const row of rows) {
      const key = row.key;
      const value = row.value;
      const updatedAt = row.updated_at || "";
      if (map[key] === void 0) {
        map[key] = value;
        meta[key] = updatedAt;
        continue;
      }
      if (APP_STORE_ENTITY_LIST_KEYS.has(key) && Array.isArray(value)) {
        if (updatedAt >= (meta[key] || "")) {
          map[key] = value;
          meta[key] = updatedAt;
        }
        continue;
      }
      if (Array.isArray(value) && Array.isArray(map[key])) {
        map[key] = mergeRecordsById(map[key], value);
        if (updatedAt >= (meta[key] || "")) meta[key] = updatedAt;
      } else if (isOverflow && primaryStorageFull) {
        map[key] = value;
        meta[key] = updatedAt;
      } else if (updatedAt >= (meta[key] || "")) {
        map[key] = value;
        meta[key] = updatedAt;
      }
    }
  };
  try {
    const { data } = await supabasePrimary.from("app_store").select("key, value, updated_at");
    ingest(data, false);
  } catch {
  }
  try {
    const { data } = await supabaseOverflow.from("app_store").select("key, value, updated_at");
    ingest(data, true);
  } catch {
  }
  return map;
}
async function selectAppStoreValue(key) {
  try {
    const { data } = await supabasePrimary.from("app_store").select("value").eq("key", key).maybeSingle();
    if (data?.value !== void 0 && data?.value !== null) return data.value;
  } catch {
  }
  try {
    const { data } = await supabaseOverflow.from("app_store").select("value").eq("key", key).maybeSingle();
    if (data?.value !== void 0 && data?.value !== null) return data.value;
  } catch {
  }
  return void 0;
}
async function upsertOnClient(client, table, rows, onConflict) {
  return client.from(table).upsert(rows, { onConflict });
}
async function upsertChunkWithRetry(client, table, rows, onConflict) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { error } = await upsertOnClient(client, table, rows, onConflict);
      if (!error) return { ok: true };
      lastError = error.message;
      if (isStorageQuotaError(error)) {
        return { ok: false, error: error.message, quotaError: true };
      }
      if (isPostgresConstraintError(error)) {
        return { ok: false, error: error.message, networkError: false };
      }
      if (!isTransientNetworkError(error)) {
        return { ok: false, error: error.message, networkError: false };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (!isTransientNetworkError(err)) {
        return { ok: false, error: lastError, networkError: false };
      }
    }
    if (attempt < MAX_RETRIES - 1) {
      await sleep(1e3 * (attempt + 1));
    }
  }
  return { ok: false, error: lastError, networkError: true };
}
async function selectPrimaryTableIds(table) {
  try {
    const { data, error } = await supabasePrimary.from(table).select("id");
    if (error || !data) return /* @__PURE__ */ new Set();
    return new Set(
      data.map((row) => String(row.id || "")).filter(Boolean)
    );
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
async function upsertRowsIndividuallyOnClient(client, table, rows, onConflict) {
  let skipped = 0;
  for (const row of rows) {
    let result = await upsertChunkWithRetry(client, table, [row], onConflict);
    if (!result.ok && table === "teachers" && isDuplicateCnicError(result.error)) {
      const id = String(row.id || "");
      const fixed = { ...row, cnic: `PENDING-${id}` };
      result = await upsertChunkWithRetry(client, table, [fixed], onConflict);
    }
    if (!result.ok) skipped += 1;
  }
  return {
    ok: skipped < rows.length,
    skipped,
    error: skipped > 0 ? `${skipped}/${rows.length} rows skipped (constraint)` : void 0
  };
}
async function upsertAllChunksOnClient(client, table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const result = await upsertChunkWithRetry(client, table, chunk, onConflict);
    if (!result.ok) return result;
  }
  return { ok: true };
}
async function writeRowsWithFailover(table, rows, onConflict) {
  if (!primaryStorageFull) {
    const primary = await upsertAllChunksOnClient(supabasePrimary, table, rows, onConflict);
    if (primary.ok) {
      await upsertAllChunksOnClient(supabaseOverflow, table, rows, onConflict).catch(() => void 0);
      return { ok: true, wroteTo: "primary" };
    }
    if (isPostgresConstraintError(primary.error)) {
      const individual = await upsertRowsIndividuallyOnClient(
        supabasePrimary,
        table,
        rows,
        onConflict
      );
      if (individual.ok) {
        if (individual.skipped > 0) {
          const reason = table === "teachers" ? "duplicate CNIC or constraint conflict (assign a unique CNIC in Teacher Hub)" : "foreign-key or constraint conflict";
          logSkippedRows(table, individual.skipped, reason);
        }
        return { ok: true, wroteTo: "primary", error: individual.error };
      }
      return { ok: false, wroteTo: "primary", error: primary.error };
    }
    const shouldTryOverflow = !isPostgresConstraintError(primary.error) && (primary.quotaError || primary.networkError || isTransientNetworkError(primary.error));
    if (primary.quotaError) markPrimaryStorageFull();
    if (shouldTryOverflow) {
      console.warn(
        `[Supabase Failover] Primary upsert failed for ${table} (${primary.error}). Trying overflow database\u2026`
      );
      const overflow2 = await upsertAllChunksOnClient(supabaseOverflow, table, rows, onConflict);
      return {
        ok: overflow2.ok,
        wroteTo: "overflow",
        error: overflow2.error
      };
    }
    return { ok: false, wroteTo: "primary", error: primary.error };
  }
  const overflow = await upsertAllChunksOnClient(supabaseOverflow, table, rows, onConflict);
  return {
    ok: overflow.ok,
    wroteTo: "overflow",
    error: overflow.error
  };
}
async function upsertTableWithFailover(table, rows, onConflict = "id") {
  if (rows.length === 0) return { ok: true, wroteTo: "none" };
  return writeRowsWithFailover(table, rows, onConflict);
}
async function upsertAppStoreRowsWithRetry(client, rows) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { error } = await client.from("app_store").upsert(rows, { onConflict: "key" });
      if (!error) return { ok: true };
      lastError = error.message;
      if (isStorageQuotaError(error)) return { ok: false, error: error.message, quotaError: true };
      if (!isTransientNetworkError(error)) return { ok: false, error: error.message };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (!isTransientNetworkError(err)) return { ok: false, error: lastError };
    }
    if (attempt < MAX_RETRIES - 1) await sleep(1e3 * (attempt + 1));
  }
  return { ok: false, error: lastError, networkError: true };
}
async function upsertSingleAppStoreRowWithFailover(row) {
  if (!primaryStorageFull) {
    const primary = await upsertAppStoreRowsWithRetry(supabasePrimary, [row]);
    if (primary.ok) {
      await upsertAppStoreRowsWithRetry(supabaseOverflow, [row]).catch(() => void 0);
      return { ok: true, wroteTo: "primary" };
    }
    const shouldTryOverflow = primary.quotaError || primary.networkError || isTransientNetworkError(primary.error);
    if (primary.quotaError) markPrimaryStorageFull();
    if (shouldTryOverflow) {
      const overflow2 = await upsertAppStoreRowsWithRetry(supabaseOverflow, [row]);
      return { ok: overflow2.ok, wroteTo: "overflow", error: overflow2.error };
    }
    return { ok: false, wroteTo: "primary", error: primary.error };
  }
  const overflow = await upsertAppStoreRowsWithRetry(supabaseOverflow, [row]);
  return { ok: overflow.ok, wroteTo: "overflow", error: overflow.error };
}
async function upsertAppStoreKeyWithFailover(key, value, updatedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  if (value === void 0 || value === null) {
    return { ok: true, wroteTo: "none" };
  }
  return upsertSingleAppStoreRowWithFailover({ key, value, updated_at: updatedAt });
}
async function upsertAppStoreWithFailover(rows) {
  if (rows.length === 0) return { ok: true, wroteTo: "none" };
  const priority = /* @__PURE__ */ new Set(["site_branding", "school_fee_settings", "admin_session"]);
  const ordered = [
    ...rows.filter((r) => priority.has(r.key)),
    ...rows.filter((r) => !priority.has(r.key))
  ];
  let wroteTo = "none";
  const failedKeys = [];
  for (const row of ordered) {
    const result = await upsertSingleAppStoreRowWithFailover(row);
    if (result.ok) {
      wroteTo = result.wroteTo;
    } else {
      failedKeys.push(row.key);
      console.warn(`[Supabase app_store] Upsert failed for key "${row.key}": ${result.error}`);
    }
  }
  return {
    ok: failedKeys.length === 0,
    wroteTo,
    error: failedKeys.length > 0 ? `Failed keys: ${failedKeys.join(", ")}` : void 0,
    failedKeys: failedKeys.length > 0 ? failedKeys : void 0
  };
}
async function reconcileOnClient(client, table, keepIds) {
  const { data: existing } = await client.from(table).select("id");
  const deleteIds = (existing || []).map((row) => row.id).filter((id) => id && !keepIds.includes(id));
  if (deleteIds.length > 0) {
    await client.from(table).delete().in("id", deleteIds);
  }
}
async function reconcileDeletesWithFailover(table, keepIds) {
  try {
    if (!primaryStorageFull) {
      await reconcileOnClient(supabasePrimary, table, keepIds);
    }
    await reconcileOnClient(supabaseOverflow, table, keepIds);
  } catch (err) {
    console.warn(`Supabase delete reconcile note (${table}):`, err);
  }
}
async function replaceCustomFieldsWithFailover(customFields) {
  if (!Array.isArray(customFields) || customFields.length === 0) {
    return { ok: true };
  }
  const writeClient = primaryStorageFull ? supabaseOverflow : supabasePrimary;
  try {
    if (!primaryStorageFull) {
      const { error: deleteErr } = await supabasePrimary.from("custom_fields").delete().neq("id", "");
      if (deleteErr && isStorageQuotaError(deleteErr)) {
        markPrimaryStorageFull();
      } else if (deleteErr) {
        return { ok: false, error: deleteErr.message };
      }
      if (!primaryStorageFull && customFields.length > 0) {
        const { error: upsertErr } = await supabasePrimary.from("custom_fields").upsert(customFields, { onConflict: "id" });
        if (upsertErr && isStorageQuotaError(upsertErr)) {
          markPrimaryStorageFull();
        } else if (upsertErr) {
          return { ok: false, error: upsertErr.message };
        } else {
          const store2 = await upsertAppStoreWithFailover([
            { key: "custom_fields", value: customFields, updated_at: (/* @__PURE__ */ new Date()).toISOString() }
          ]);
          return { ok: store2.ok, error: store2.error };
        }
      }
    }
    if (primaryStorageFull) {
      const overflowClient = supabaseOverflow;
      const { error: deleteErr } = await overflowClient.from("custom_fields").delete().neq("id", "");
      if (deleteErr) return { ok: false, error: deleteErr.message };
      if (customFields.length > 0) {
        const { error: upsertErr } = await overflowClient.from("custom_fields").upsert(customFields, { onConflict: "id" });
        if (upsertErr) return { ok: false, error: upsertErr.message };
      }
      const store2 = await upsertAppStoreWithFailover([
        { key: "custom_fields", value: customFields, updated_at: (/* @__PURE__ */ new Date()).toISOString() }
      ]);
      return { ok: store2.ok, error: store2.error };
    }
    const store = await upsertAppStoreWithFailover([
      { key: "custom_fields", value: customFields, updated_at: (/* @__PURE__ */ new Date()).toISOString() }
    ]);
    return { ok: store.ok, error: store.error };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
async function downloadStorageWithFailover(bucketName, storagePath) {
  for (const client of [supabasePrimary, supabaseOverflow]) {
    const { data, error } = await client.storage.from(bucketName).download(storagePath);
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      const contentType = data.type || (storagePath.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
      return { ok: true, buffer, contentType };
    }
  }
  return { ok: false, error: "File not found in Supabase Storage" };
}
async function uploadStorageWithFailover(bucketName, storagePath, buffer, contentType) {
  const options = { upsert: true, contentType };
  if (!primaryStorageFull) {
    const { error } = await supabasePrimary.storage.from(bucketName).upload(storagePath, buffer, options);
    if (!error) return { ok: true, publicUrlClient: supabasePrimary };
    if (isStorageQuotaError(error)) {
      markPrimaryStorageFull();
      const { error: overflowErr2 } = await supabaseOverflow.storage.from(bucketName).upload(storagePath, buffer, options);
      return {
        ok: !overflowErr2,
        publicUrlClient: supabaseOverflow,
        error: overflowErr2?.message
      };
    }
    const policyBlocked = String(error.message || "").toLowerCase().includes("row-level security");
    if (policyBlocked) {
      const { error: overflowErr2 } = await supabaseOverflow.storage.from(bucketName).upload(storagePath, buffer, options);
      if (!overflowErr2) return { ok: true, publicUrlClient: supabaseOverflow };
    }
    return { ok: false, publicUrlClient: supabasePrimary, error: error.message };
  }
  const { error: overflowErr } = await supabaseOverflow.storage.from(bucketName).upload(storagePath, buffer, options);
  return {
    ok: !overflowErr,
    publicUrlClient: supabaseOverflow,
    error: overflowErr?.message
  };
}
async function persistEmailLogToSupabase(logEntry) {
  const result = await upsertTableWithFailover("email_logs", [logEntry], "id");
  if (result.ok) return;
  try {
    const existing = await selectAppStoreValue("email_logs");
    const list = Array.isArray(existing) ? existing : [];
    await upsertAppStoreWithFailover([
      {
        key: "email_logs",
        value: [logEntry, ...list],
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
  } catch {
  }
}

// emailHtmlBuilder.ts
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatBodyHtml(body, isPlainTextBody) {
  if (!isPlainTextBody) return body;
  return escapeHtml(body).replace(/\n/g, "<br/>");
}
function buildBrandedEmailHtml(options) {
  const branding = options.branding || {};
  const accent = options.accentColor || "#1e3a8a";
  const headerTitle = escapeHtml(options.headerTitle || branding.school_name || "UNIQUE SCHOOL SYSTEM");
  const headerSubtitle = escapeHtml(
    options.headerBadge || branding.header_subtitle || "Official Notification"
  );
  const footerText = escapeHtml(
    options.footer || branding.footer_subtitle || branding.footer_contact || "Unique School System"
  );
  const bodyHtml = formatBodyHtml(options.body || "", options.isPlainTextBody !== false);
  const logoBlock = branding.logo_url ? `<div style="margin-bottom: 12px;">
        <img src="${branding.logo_url}" alt="${escapeHtml(branding.school_name || "School Logo")}" style="max-height: 80px; max-width: 220px; display: block; margin: 0 auto; object-fit: contain;" />
      </div>` : "";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: ${accent}; color: #ffffff; padding: 24px 20px; text-align: center;">
        ${logoBlock}
        <h2 style="margin: 0; font-size: 18px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">${headerTitle}</h2>
        <p style="margin: 8px 0 0 0; font-size: 11px; opacity: 0.9; letter-spacing: 0.08em; text-transform: uppercase;">${headerSubtitle}</p>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.65; font-size: 14px;">
        ${bodyHtml}
      </div>
      <div style="background-color: #f8fafc; padding: 16px 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
        ${footerText}
      </div>
    </div>
  `.trim();
}

// entityDocumentDatabase.ts
init_entityDocumentBlobStore();
var supabaseBlobOps = null;
var appStoreBlobOps = null;
function registerSupabaseEntityBlobOps(ops) {
  supabaseBlobOps = ops;
}
function registerAppStoreEntityBlobOps(ops) {
  appStoreBlobOps = ops;
}
async function persistEntityDocumentToDatabase(mongoDb, bucket, storagePath, buffer, contentType) {
  const id = entityBlobKey(bucket, storagePath);
  const row = {
    id,
    bucket,
    storage_path: storagePath,
    content_type: contentType,
    content_base64: buffer.toString("base64"),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const mongo = await persistEntityDocumentBlob(mongoDb, bucket, storagePath, buffer, contentType);
  let supabase2 = false;
  if (supabaseBlobOps) {
    try {
      supabase2 = await supabaseBlobOps.upsert(row);
    } catch {
      supabase2 = false;
    }
  }
  let appStore = false;
  if (!mongo && !supabase2 && appStoreBlobOps) {
    try {
      appStore = await appStoreBlobOps.upsert(row);
    } catch {
      appStore = false;
    }
  }
  return { ok: mongo || supabase2 || appStore, mongo, supabase: supabase2 };
}
async function loadEntityDocumentFromDatabase(mongoDb, bucket, storagePath) {
  const mongo = await loadEntityDocumentBlob(mongoDb, bucket, storagePath);
  if (mongo.ok && mongo.buffer) return mongo;
  if (supabaseBlobOps) {
    try {
      const doc = await supabaseBlobOps.load(entityBlobKey(bucket, storagePath));
      if (doc?.content_base64) {
        return {
          ok: true,
          buffer: Buffer.from(String(doc.content_base64), "base64"),
          contentType: String(doc.content_type || "application/octet-stream")
        };
      }
    } catch {
    }
  }
  if (appStoreBlobOps) {
    try {
      const doc = await appStoreBlobOps.load(entityBlobKey(bucket, storagePath));
      if (doc?.content_base64) {
        return {
          ok: true,
          buffer: Buffer.from(String(doc.content_base64), "base64"),
          contentType: String(doc.content_type || "application/octet-stream")
        };
      }
    } catch {
    }
  }
  return { ok: false };
}
async function loadEntityDocumentFromDatabaseAuto(bucket, storagePath) {
  const { loadEntityDocumentBlobAuto: loadEntityDocumentBlobAuto3 } = await Promise.resolve().then(() => (init_entityDocumentBlobStore(), entityDocumentBlobStore_exports));
  const mongo = await loadEntityDocumentBlobAuto3(bucket, storagePath);
  if (mongo.ok && mongo.buffer) return mongo;
  if (supabaseBlobOps) {
    try {
      const doc = await supabaseBlobOps.load(entityBlobKey(bucket, storagePath));
      if (doc?.content_base64) {
        return {
          ok: true,
          buffer: Buffer.from(String(doc.content_base64), "base64"),
          contentType: String(doc.content_type || "application/octet-stream")
        };
      }
    } catch {
    }
  }
  if (appStoreBlobOps) {
    try {
      const doc = await appStoreBlobOps.load(entityBlobKey(bucket, storagePath));
      if (doc?.content_base64) {
        return {
          ok: true,
          buffer: Buffer.from(String(doc.content_base64), "base64"),
          contentType: String(doc.content_type || "application/octet-stream")
        };
      }
    } catch {
    }
  }
  return { ok: false };
}

// emailAttachmentHelpers.ts
function extFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("gif")) return "gif";
  if (m.includes("bmp")) return "bmp";
  if (m.includes("tiff") || m.includes("tif")) return "tiff";
  if (m.includes("svg")) return "svg";
  if (m.includes("heic") || m.includes("heif")) return "heic";
  if (m.includes("msword") || m.includes("application/word")) return "doc";
  if (m.includes("openxmlformats-officedocument.wordprocessingml")) return "docx";
  if (m.includes("excel") || m.includes("spreadsheetml.sheet")) return "xlsx";
  if (m.includes("vnd.ms-excel")) return "xls";
  if (m.includes("powerpoint") || m.includes("presentationml.presentation")) return "pptx";
  if (m.includes("vnd.ms-powerpoint")) return "ppt";
  if (m.includes("rtf")) return "rtf";
  if (m.includes("plain") || m.includes("text/") && !m.includes("html") && !m.includes("csv")) return "txt";
  if (m.includes("csv")) return "csv";
  if (m.includes("html") || m.includes("htm")) return "html";
  if (m.includes("zip") || m.includes("compressed")) return "zip";
  if (m.includes("rar")) return "rar";
  if (m.includes("7z") || m.includes("7-zip")) return "7z";
  if (m.includes("tar")) return "tar";
  if (m.includes("gz") || m.includes("gzip")) return "gz";
  if (m.includes("mp3") || m.includes("mpeg") && m.includes("audio")) return "mp3";
  if (m.includes("mp4") || m.includes("video/mp4")) return "mp4";
  if (m.includes("wav")) return "wav";
  if (m.includes("avi")) return "avi";
  if (m.includes("mov") || m.includes("quicktime")) return "mov";
  if (m.includes("json")) return "json";
  if (m.includes("xml")) return "xml";
  if (m.includes("vcard") || m.includes("vcf")) return "vcf";
  if (m.includes("ics")) return "ics";
  return "";
}
function extFromMagicBytes(buffer) {
  let bytes;
  if (typeof buffer === "string") {
    try {
      const b64 = buffer.includes(",") ? buffer.split(",")[1] : buffer;
      const binary = atob(b64);
      const len = Math.min(binary.length, 16);
      bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    } catch {
      return "";
    }
  } else if (Buffer.isBuffer(buffer)) {
    const len = Math.min(buffer.length, 16);
    bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = buffer[i];
  } else {
    const len = Math.min(buffer.length, 16);
    bytes = buffer.slice(0, len);
  }
  const b = bytes;
  if (b.length >= 4 && b[0] === 37 && b[1] === 80 && b[2] === 68 && b[3] === 70) return "pdf";
  if (b.length >= 8 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10) return "png";
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return "jpg";
  if (b.length >= 6 && (b[0] === 71 && b[1] === 73 && b[2] === 70 && b[3] === 56 && (b[4] === 55 || b[4] === 57) && b[5] === 97)) return "gif";
  if (b.length >= 12 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80) return "webp";
  if (b.length >= 2 && b[0] === 66 && b[1] === 77) return "bmp";
  if (b.length >= 4 && b[0] === 80 && b[1] === 75 && b[2] === 3 && b[3] === 4) return "zip";
  if (b.length >= 8 && b[0] === 82 && b[1] === 97 && b[2] === 114 && b[3] === 33 && b[4] === 26 && b[5] === 7 && (b[6] === 0 || b[6] === 1)) return "rar";
  if (b.length >= 3 && b[0] === 31 && b[1] === 139 && b[2] === 8) return "gz";
  if (b.length >= 6 && b[0] === 117 && b[1] === 115 && b[2] === 116 && b[3] === 97 && b[4] === 114) return "tar";
  if (b.length >= 4 && (b[0] === 73 && b[1] === 73 && b[2] === 42 && b[3] === 0) || b[0] === 77 && b[1] === 77 && b[2] === 0 && b[3] === 42) return "tiff";
  if (b.length >= 3 && (b[0] === 73 && b[1] === 68 && b[2] === 51) || b[0] === 73 && b[1] === 68 && b[2] === 50) return "mp3";
  if (b.length >= 12 && b[4] === 102 && b[5] === 116 && b[6] === 121 && b[7] === 112) return "mp4";
  if (b.length >= 4 && b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70) return "wav";
  if (b.length >= 8 && (b[0] === 48 || b[0] === 49 || b[0] === 50) && b[1] === 0 && b[2] === 0 && b[3] === 0 && (b[4] === 102 && b[5] === 116 && b[6] === 121 && b[7] === 112)) return "mov";
  return "";
}
function resolveExtension(mime, buffer, fallbackPathExt) {
  const BLOCKED_EXTS = /* @__PURE__ */ new Set(["bin", "exe", "bat", "cmd", "com", "scr", "pif", "vbs", "js", "msi", "reg", "ps1"]);
  if (fallbackPathExt && !BLOCKED_EXTS.has(fallbackPathExt.toLowerCase())) return fallbackPathExt.toLowerCase();
  const fromMime = extFromMime(mime);
  if (fromMime) return fromMime;
  if (buffer) {
    const fromMagic = extFromMagicBytes(buffer);
    if (fromMagic) return fromMagic;
  }
  return "dat";
}
function safeFilenamePart(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "Document";
}
function isDocumentUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  return value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/api/supabase/file") || value.includes(".pdf") || value.length > 100;
}
function resolveDocumentSourceUrl(source) {
  if (source.url && isDocumentUrl(source.url)) return source.url;
  if (source.storage_path) {
    return buildEntityDocProxyUrl(source.storage_path, source.storage_bucket || ENTITY_DOCS_BUCKET);
  }
  return null;
}
function collectStudentProfileDocuments(student) {
  const docs = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (doc) => {
    const url = resolveDocumentSourceUrl(doc);
    if (!url || seen.has(url)) return;
    seen.add(url);
    docs.push({ ...doc, url });
  };
  const standardFields = [
    { key: "profile_image_url", label: "Profile Photo" },
    { key: "b_form_doc", label: "B-Form / Birth Certificate" },
    { key: "father_cnic_doc", label: "Father CNIC Scan" },
    { key: "death_certificate_doc", label: "Death Certificate" },
    { key: "leaving_cert_doc", label: "Leaving Certificate" }
  ];
  for (const { key, label } of standardFields) {
    const url = student[key];
    if (isDocumentUrl(url)) add({ title: label, url });
  }
  const customFields = student.custom_fields;
  if (customFields && typeof customFields === "object") {
    for (const [fieldName, value] of Object.entries(customFields)) {
      if (isDocumentUrl(value)) {
        add({ title: `Custom - ${fieldName}`, url: value });
      }
    }
  }
  if (Array.isArray(student.document_gallery)) {
    for (const entry of student.document_gallery) {
      if (!entry) continue;
      add({
        title: entry.title?.trim() || "Gallery Document",
        url: entry.url,
        storage_path: entry.storage_path,
        storage_bucket: entry.storage_bucket
      });
    }
  }
  return docs;
}
function collectTeacherProfileDocuments(teacher) {
  const docs = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (doc) => {
    const url = resolveDocumentSourceUrl(doc);
    if (!url || seen.has(url)) return;
    seen.add(url);
    docs.push({ ...doc, url });
  };
  const standardFields = [
    { key: "profile_image_url", label: "Profile Photo" },
    { key: "cnic_doc", label: "CNIC Card Scan" },
    { key: "degree_doc", label: "Degree Certificate" },
    { key: "work_exp_doc", label: "Work Experience Certificate" }
  ];
  for (const { key, label } of standardFields) {
    const url = teacher[key];
    if (isDocumentUrl(url)) add({ title: label, url });
  }
  const customFields = teacher.custom_fields;
  if (customFields && typeof customFields === "object") {
    for (const [fieldName, value] of Object.entries(customFields)) {
      if (isDocumentUrl(value)) {
        add({ title: `Custom - ${fieldName}`, url: value });
      }
    }
  }
  if (Array.isArray(teacher.document_gallery)) {
    for (const entry of teacher.document_gallery) {
      if (!entry) continue;
      add({
        title: entry.title?.trim() || "Gallery Document",
        url: entry.url,
        storage_path: entry.storage_path,
        storage_bucket: entry.storage_bucket
      });
    }
  }
  return docs;
}
function collectProfileDocumentSources(entity, entityType) {
  return entityType === "student" ? collectStudentProfileDocuments(entity) : collectTeacherProfileDocuments(entity);
}
async function attachmentFromDocumentSource(source, baseName) {
  const bucket = source.storage_bucket || ENTITY_DOCS_BUCKET;
  let url = resolveDocumentSourceUrl(source);
  if (!url && !source.storage_path) return null;
  if (!url && source.storage_path) {
    url = buildEntityDocProxyUrl(source.storage_path, bucket);
  }
  if (!url) return null;
  let att = null;
  if (url.startsWith("data:")) {
    att = attachmentFromDataUrl(url, baseName);
  } else if (url.includes("/api/supabase/file")) {
    att = await attachmentFromSupabaseFileUrl(url, baseName);
  } else if (url.startsWith("http://") || url.startsWith("https://")) {
    att = await attachmentFromHttpUrl(url, baseName);
  }
  if (!att && source.storage_path) {
    att = await attachmentFromStoragePath(source.storage_path, bucket, baseName);
  }
  return att;
}
async function buildProfileDocumentGalleryAttachments(entity, entityType, filenamePrefix) {
  const sources = collectProfileDocumentSources(entity, entityType);
  if (sources.length === 0) return [];
  const attachments = [];
  const usedNames = /* @__PURE__ */ new Set();
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    let baseName = `${filenamePrefix}_${safeFilenamePart(source.title)}`;
    if (usedNames.has(baseName)) baseName = `${baseName}_${i + 1}`;
    usedNames.add(baseName);
    const att = await attachmentFromDocumentSource(source, baseName);
    if (att) attachments.push(att);
  }
  return attachments;
}
function attachmentFromDataUrl(url, baseName) {
  const match = url.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  const ext = resolveExtension(match[1], match[2]);
  return {
    filename: `${safeFilenamePart(baseName)}.${ext}`,
    content: match[2],
    encoding: "base64"
  };
}
async function attachmentFromHttpUrl(url, baseName) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "";
    const ext = resolveExtension(ct, buffer);
    return {
      filename: `${safeFilenamePart(baseName)}.${ext}`,
      content: buffer.toString("base64"),
      encoding: "base64"
    };
  } catch {
    return null;
  }
}
async function attachmentFromStoragePath(storagePath, bucketName, baseName) {
  try {
    let download = await downloadStorageWithFailover(bucketName, storagePath);
    if (!download.ok || !download.buffer) {
      download = await loadEntityDocumentFromDatabaseAuto(bucketName, storagePath);
    }
    if (!download.ok || !download.buffer) return null;
    const pathExt = storagePath.split(".").pop();
    const validatedPathExt = pathExt && pathExt.length <= 5 ? pathExt : void 0;
    const ext = resolveExtension(download.contentType || "", download.buffer, validatedPathExt);
    return {
      filename: `${safeFilenamePart(baseName)}.${ext}`,
      content: download.buffer.toString("base64"),
      encoding: "base64"
    };
  } catch {
    return null;
  }
}
async function attachmentFromSupabaseFileUrl(url, baseName) {
  try {
    const parsed = new URL(url, "http://localhost");
    if (!parsed.pathname.includes("/api/supabase/file")) return null;
    const storagePath = parsed.searchParams.get("path") || "";
    const bucketName = parsed.searchParams.get("bucket") || ENTITY_DOCS_BUCKET;
    if (!storagePath || !storagePath.includes("/")) return null;
    const download = await downloadStorageWithFailover(bucketName, storagePath);
    if (!download.ok || !download.buffer) return null;
    const pathExt = storagePath.split(".").pop();
    const validatedPathExt = pathExt && pathExt.length <= 5 ? pathExt : void 0;
    const ext = resolveExtension(download.contentType || "", download.buffer, validatedPathExt);
    return {
      filename: `${safeFilenamePart(baseName)}.${ext}`,
      content: download.buffer.toString("base64"),
      encoding: "base64"
    };
  } catch {
    return null;
  }
}

// server.ts
init_entityDocumentBlobStore();

// entityDocumentPersist.ts
var STUDENT_DOC_FIELDS = [
  "profile_image_url",
  "b_form_doc",
  "father_cnic_doc",
  "death_certificate_doc",
  "leaving_cert_doc"
];
var TEACHER_DOC_FIELDS = [
  "profile_image_url",
  "cnic_doc",
  "degree_doc",
  "work_exp_doc"
];
function isDataDocumentUrl(value) {
  return typeof value === "string" && value.startsWith("data:") && value.length > 50;
}
function isPersistedProxyUrl(value) {
  return typeof value === "string" && value.startsWith("/api/supabase/file");
}
function isPersistedRemoteUrl(value) {
  return typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://"));
}
function contentTypeForExt(ext) {
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return `image/${ext === "jpg" ? "jpeg" : ext}`;
}
function buildEntityFieldStoragePath(entityType, entityId, fieldKey, ext) {
  const safeId = entityId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeField = fieldKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${entityType}/${safeId}/fields/${safeField}.${ext}`;
}
function buildEntityCustomFieldStoragePath(entityType, entityId, fieldName, ext) {
  const safeId = entityId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeField = fieldName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${entityType}/${safeId}/custom/${safeField}.${ext}`;
}
async function persistDataUrlToDatabase(mongoDb, dataUrl, storagePath) {
  const ext = inferDocumentExt(dataUrl);
  const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  const contentType = contentTypeForExt(ext);
  if (isCloudinaryConfigured()) {
    const cloud = await uploadBufferToCloudinary(buffer, storagePath, contentType);
    if (cloud.ok && cloud.secureUrl && cloud.publicId) {
      return {
        ok: true,
        url: cloud.secureUrl,
        storage_path: cloud.publicId,
        storage_bucket: CLOUDINARY_BUCKET
      };
    }
  }
  const saved = await persistEntityDocumentToDatabase(
    mongoDb,
    ENTITY_DOCS_BUCKET,
    storagePath,
    buffer,
    contentType
  );
  if (!saved.ok) return { ok: false, url: dataUrl };
  return {
    ok: true,
    url: buildEntityDocProxyUrl(storagePath),
    storage_path: storagePath,
    storage_bucket: ENTITY_DOCS_BUCKET
  };
}
async function hydrateEntityAllDocuments(row, entityType, mongoDb) {
  const entityId = String(row.id || "");
  if (!entityId) return row;
  const out = { ...row };
  const docFields = entityType === "students" ? STUDENT_DOC_FIELDS : TEACHER_DOC_FIELDS;
  for (const fieldKey of docFields) {
    const value = out[fieldKey];
    if (isDataDocumentUrl(value)) {
      const ext = inferDocumentExt(value);
      const storagePath = buildEntityFieldStoragePath(entityType, entityId, fieldKey, ext);
      const persisted = await persistDataUrlToDatabase(mongoDb, value, storagePath);
      if (persisted.ok) out[fieldKey] = persisted.url;
    } else if (isPersistedProxyUrl(value) || isPersistedRemoteUrl(value)) {
      out[fieldKey] = value;
    }
  }
  const customFields = out.custom_fields;
  if (customFields && typeof customFields === "object" && !Array.isArray(customFields)) {
    const nextCustom = { ...customFields };
    for (const [fieldName, value] of Object.entries(nextCustom)) {
      if (isDataDocumentUrl(value)) {
        const ext = inferDocumentExt(value);
        const storagePath = buildEntityCustomFieldStoragePath(entityType, entityId, fieldName, ext);
        const persisted = await persistDataUrlToDatabase(mongoDb, value, storagePath);
        if (persisted.ok) nextCustom[fieldName] = persisted.url;
      }
    }
    out.custom_fields = nextCustom;
  }
  if (Array.isArray(out.document_gallery)) {
    const gallery = await Promise.all(
      out.document_gallery.map(async (doc) => {
        if (!doc) return doc;
        if (doc.url && !String(doc.url).startsWith("data:")) {
          return normalizeGalleryDocForStore({
            ...doc,
            storage_persisted: doc.storage_persisted ?? true
          });
        }
        const docId = doc.id || `gal-${Date.now()}`;
        const ext = inferDocumentExt(String(doc.url), doc.title);
        const storagePath = doc.storage_path || buildEntityDocStoragePath(entityType, entityId, docId, ext);
        const persisted = await persistDataUrlToDatabase(mongoDb, String(doc.url), storagePath);
        return normalizeGalleryDocForStore({
          ...doc,
          id: docId,
          url: persisted.ok ? persisted.url : doc.url,
          storage_path: persisted.storage_path || storagePath,
          storage_bucket: persisted.storage_bucket || ENTITY_DOCS_BUCKET,
          storage_persisted: persisted.ok
        });
      })
    );
    out.document_gallery = gallery.filter((doc) => doc && (doc.url || doc.storage_path));
  }
  return out;
}
async function hydrateEntityListAllDocuments(items, entityType, mongoDb) {
  if (!Array.isArray(items)) return items;
  return Promise.all(
    items.map(async (item) => {
      if (!item || typeof item !== "object") return item;
      return hydrateEntityAllDocuments(item, entityType, mongoDb);
    })
  );
}

// groqSystemFaq.ts
var USS_SYSTEM_FAQ = `
# UNIQUE SCHOOL SYSTEM (USS) \u2014 OFFICIAL ERP FAQ
Principal: Abdul Rehman Jamil

## GENERAL
- USS is a school management ERP: attendance, admissions, students, teachers, fees, payroll, expenses, emails, batch exam results, reporting, and site settings.
- Data saves to Supabase (primary) with MongoDB backup for custom fields. Changes sync when you save/add/delete \u2014 not on a timer.
- Protected admin modules require unlocking via the Admin button (password is set by the school administrator in server configuration).
- Attendance Console is public (no admin password) for classroom teachers.
- Activity & Email Logs button shows Brevo email dispatch history.
- Site Settings (gear icon) edits header/footer branding and shows database sync status.
- Use one browser tab when deleting records; wait for sync to finish before hard refresh.

## NAVIGATION (top menu)
1. Attendance Console \u2014 public
2. Student Admissions \u2014 admin
3. Student Directory & Hub \u2014 admin
4. Teacher Hub & Staff \u2014 admin
5. Fee Manager \u2014 admin
6. Payroll Manager \u2014 admin
7. Expense Tracker \u2014 admin
8. Email Designer \u2014 admin
9. Batch Results Parser \u2014 admin
10. Global Excel Reporting \u2014 admin
11. Groq AI Assistant \u2014 admin (this help chat)

---

## 1. ATTENDANCE CONSOLE
- Dual-phase logging: Phase 1 = student class roster (by class, per date). Phase 2 = master staff/faculty logs.
- Status codes: P = Present, A = Absent, L = Leave, HL = Half Leave (can add reason).
- After you submit a class attendance sheet for a date, it is locked for that date. Admins can log in and update locked student or staff attendance.
- Mark All Staff Present override available in Phase 2 for faculty.

## 2. STUDENT ADMISSIONS
- Register new students with full profile: roll number, class, parent/guardian, orphan sponsorship fields, B-Form, custom dynamic fields.
- Saves immediately to database on submit.

## 3. STUDENT DIRECTORY & HUB
- Search/filter all students. Open a student Hub for full profile.
- Hub tabs include: profile edit, attendance history, fee vouchers, evaluation tree (exam results), documents, PDF profile, email share.
- Evaluation tree shows Weekly Tests, Monthly Tests, and Term Examinations per student.
- Preview on an exam result shows the uploaded PDF (from batch parser or manual upload).
- Add/edit/delete exam results from the Hub. Bulk delete filtered results available.

## 4. TEACHER HUB & STAFF
- Faculty directory with CNIC, designation, classes, salary base scale.
- Add/edit/delete teachers. Export faculty Excel. Faculty attendance ties into Payroll.

## 5. FEE MANAGER
- Fee vouchers per student per month/year: tuition, net fee, paid amount, status (Paid/Unpaid/Partial).
- Orphan students may have sponsorship/donor fields on student record.
- School fee settings (amounts/rules) configurable and synced.
- Generate vouchers, record payments, export fee ledger Excel.

## 6. PAYROLL MANAGER
- Monthly payroll per teacher: base salary, present/absent/half-leave days from attendance, deductions, net salary.
- Syncs with teacher attendance records.

## 7. EXPENSE TRACKER
- Log school expenses: date, category, amount, description, payment mode, receipt upload.
- Receipt scan uses Gemini OCR (separate from this assistant) when GEMINI_API_KEY is set.
- Custom expense fields supported.

## 8. EMAIL DESIGNER
- Create/edit HTML email templates with header, body, footer, merge tags (student name, roll, etc.).
- Send test preview emails via Brevo SMTP.
- Templates used for progress reports and system emails.

## 9. BATCH RESULTS PARSER
Three modes:
A) Batch Folder Upload \u2014 upload PDFs named by roll number (e.g. S-USS-02.pdf). System matches roll to student directory.
B) Excel Spreadsheet \u2014 upload .xlsx with Roll Number, subject marks, Name columns.
C) Supabase Storage Tree \u2014 browse uploaded results by Session \u2192 Category \u2192 Sub-period.

Configuration (set once per batch):
- Evaluation Category: Weekly Test, Monthly Test, 1st Term, 2nd Term, Final
- Academic Session folder name (e.g. Session 2026, Session 2027)
- Evaluation date (auto-calculates week/month for weekly/monthly tests)
- Exam/report title

Important:
- "Send progress report emails after batch commit" checkbox is OFF by default. Turn ON only if you want Brevo emails to guardians/donors.
- PDF batch only saves results for roll numbers found in student directory; unmatched files are skipped.
- Results save to student evaluation tree linked by student_id and roll number.
- Storage path format: Session/ExamType/[Month/Week]/RollNumber.pdf
- Load Test Bundle creates sample PDFs for first 5 students (demo only).

## 10. GLOBAL EXCEL REPORTING
- Export master spreadsheets: students, teachers, attendance grids, fees, payroll.
- Single-student attendance export from Student Hub.

## 11. SITE SETTINGS
- Edit school name, header subtitle, footer text, contact info shown on portal and emails.
- View Supabase/MongoDB connection and sync status.

## 12. DATA & SYNC
- Save/delete/update triggers partial sync (only the changed module) \u2014 faster than full sync.
- Deletes persist after refresh if sync completes; use one tab to avoid stale overwrites.
- Exam result PDFs stored in Supabase Storage bucket "student-results"; preview loads from file_url or storage_path.

## 13. ORPHAN / SPONSORSHIP STUDENTS
- Mark student as orphan in admissions/profile.
- Donor name, email, phone stored on student record.
- Batch parser and emails send to donor_email for orphan students when email checkbox is enabled.

## COMMON QUESTIONS
Q: How do I upload term exam PDFs for all students?
A: Admin unlock \u2192 Batch Results Parser \u2192 set Session & 1st Term \u2192 upload folder of PDFs named RollNumber.pdf \u2192 Execute Parser. Optional: enable email checkbox.

Q: Where do uploaded results appear?
A: Batch Results Parser \u2192 Document Tree; and each student's Hub \u2192 Evaluation Tree filtered by roll number.

Q: Why was a PDF skipped in batch upload?
A: Roll number in filename not found in Student Directory. Add the student first or fix filename.

Q: How do I delete a student/teacher/fee record?
A: Open the module \u2192 delete button on the row \u2192 wait for sync indicator to finish.

Q: Attendance won't edit for a past date?
A: Submitted attendance is locked for that date. Unlock admin (Admin button), open the same date/class, edit, and click Save Admin Updates.

Q: How do I unlock admin modules?
A: Click Admin Locked button \u2192 enter the admin password configured for your school.

Q: Emails not sending from batch parser?
A: Check "Send progress report emails" checkbox is ON, student has guardian_email or donor_email, and Brevo SMTP is configured in .env.

Q: Assistant not responding?
A: Ensure GROQ_API_KEY in .env and restart dev server (npm run dev).
`.trim();
var GROQ_SYSTEM_INSTRUCTION = `You are the Unique School System (USS) ERP help assistant for Principal Abdul Rehman Jamil.

STRICT RULES:
1. Answer ONLY using the OFFICIAL SYSTEM FAQ below and USS/school admin topics.
2. If the FAQ covers the question, give clear step-by-step instructions referencing the correct module name from the menu.
3. If asked about unrelated topics (general knowledge, coding, politics, etc.), politely say you only help with USS ERP usage and offer to answer a system question.
4. Do NOT invent live database counts, student names, or roll numbers unless the user provides that data in their message.
5. Be concise, professional, and practical. Use numbered steps when explaining workflows.
6. If unsure and the FAQ does not cover it, say so and suggest which module to check or contact the developer.

OFFICIAL SYSTEM FAQ:
${USS_SYSTEM_FAQ}`;

// server.ts
var app = (0, import_express.default)();
var PORT = 3e3;
var activeDbSync = null;
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
var emailLogs = [];
async function persistEmailLog(logEntry) {
  emailLogs.unshift(logEntry);
  await persistEmailLogToSupabase(logEntry);
  const db = await getMongoDb();
  if (db) {
    await db.collection("email_logs").updateOne(
      { id: logEntry.id },
      { $set: logEntry },
      { upsert: true }
    );
  }
}
async function reconcileSupabaseDeletes(table, keepIds) {
  await reconcileDeletesWithFailover(table, keepIds);
}
async function resolveTeacherCnicConflicts(rows) {
  try {
    const merged = await selectMergedTable("teachers");
    return resolveTeachersCnicForUpsert(
      rows,
      merged.data
    );
  } catch {
    return resolveTeachersCnicInList(rows);
  }
}
async function persistEntityListEarly(storeKey, items, storeUpdatedAt, syncStatus) {
  if (!Array.isArray(items)) return items;
  const stored = await selectAppStoreValue(storeKey);
  let resolved = resolveEntityListForStoreWrite(
    stored,
    items
  );
  if (storeKey === "teachers" && Array.isArray(resolved)) {
    resolved = resolveTeachersCnicInList(resolved);
  }
  if (storeKey === "students" || storeKey === "teachers") {
    const db = await getMongoDb();
    resolved = await hydrateEntityListAllDocuments(
      resolved,
      storeKey === "students" ? "students" : "teachers",
      db
    );
  }
  const storeResult = await upsertAppStoreKeyWithFailover(
    storeKey,
    stripEntityListForStore(resolved),
    storeUpdatedAt
  );
  if (storeResult.ok) syncStatus.supabase = true;
  else if (storeResult.error) {
    syncStatus.errors.push(`Supabase app_store ${storeKey}: ${storeResult.error}`);
  }
  return resolved;
}
async function syncSupabaseTableWithDeletes(table, items, transform) {
  if (!Array.isArray(items)) return false;
  let rows = transform ? transform(items) : items.filter(
    (item) => Boolean(item && typeof item === "object" && item.id)
  );
  if (table === "teachers") {
    rows = await resolveTeacherCnicConflicts(rows);
  }
  const keepIds = collectIds(rows);
  const maxIncomingCreated = rows.length > 0 ? Math.max(0, ...rows.map((r) => entityCreatedAtMs(r))) : 0;
  if (maxIncomingCreated > 0) {
    try {
      const merged = await selectMergedTable(table);
      const existing = merged.data || [];
      const protectedIds = existing.filter((row) => {
        const rowId = String(row.id || "");
        if (!rowId || keepIds.includes(rowId)) return false;
        return entityCreatedAtMs(row) > maxIncomingCreated;
      }).map((row) => String(row.id));
      if (protectedIds.length > 0) {
        console.warn(
          `[DB_SYNC] Protecting ${protectedIds.length} newer ${table} row(s) from stale delete \u2014 client newest=${maxIncomingCreated}, protected IDs: ${protectedIds.slice(0, 5).join(",")}${protectedIds.length > 5 ? "\u2026" : ""}`
        );
        keepIds.push(...protectedIds);
      }
    } catch {
    }
  }
  if (rows.length > 0) {
    const result = await upsertTableWithFailover(table, rows, "id");
    if (!result.ok) {
      console.warn(
        `Supabase upsert ${table}: ${result.error || "unknown error"} (target=${result.wroteTo})`
      );
      return false;
    }
  }
  await reconcileSupabaseDeletes(table, keepIds);
  return true;
}
async function syncMongoCollectionWithDeletes(db, collection, items) {
  if (!Array.isArray(items)) return;
  const keepIds = [];
  const maxIncomingCreated = items.length > 0 ? Math.max(0, ...items.map((r) => entityCreatedAtMs(r || {}))) : 0;
  for (const item of items) {
    if (!item || typeof item !== "object" || !item.id) continue;
    const clean = { ...item };
    delete clean._id;
    keepIds.push(item.id);
    await db.collection(collection).updateOne(
      { id: item.id },
      { $set: clean },
      { upsert: true }
    );
  }
  if (maxIncomingCreated > 0) {
    try {
      const allRows = await db.collection(collection).find({}).toArray();
      const protectedIds = [];
      for (const row of allRows) {
        const rowId = String(row.id || "");
        if (!rowId || keepIds.includes(rowId)) continue;
        if (entityCreatedAtMs(row) > maxIncomingCreated) {
          protectedIds.push(rowId);
        }
      }
      if (protectedIds.length > 0) {
        console.warn(
          `[MongoDB] Protecting ${protectedIds.length} newer ${collection} row(s) from stale delete \u2014 client newest=${maxIncomingCreated}`
        );
        keepIds.push(...protectedIds);
      }
    } catch {
    }
  }
  if (keepIds.length === 0) {
    await db.collection(collection).deleteMany({});
    return;
  }
  await db.collection(collection).deleteMany({ id: { $nin: keepIds } });
}
async function persistMongoAppStore(db, key, value) {
  await db.collection("app_store").updateOne(
    { key },
    { $set: { key, value, updated_at: (/* @__PURE__ */ new Date()).toISOString() } },
    { upsert: true }
  );
}
var DEFAULT_SITE_BRANDING = {
  school_name: "UNIQUE SCHOOL SYSTEM",
  header_subtitle: "Production Management Portal",
  footer_subtitle: "Principal: Abdul Rehman Jamil | Unique School System",
  footer_contact: "Main Campus, Block-4, Education District, Pakistan"
};
async function loadSiteBranding() {
  try {
    const value = await selectAppStoreValue("site_branding");
    if (value && typeof value === "object") {
      return { ...DEFAULT_SITE_BRANDING, ...value };
    }
  } catch {
  }
  try {
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection("app_store").findOne({ key: "site_branding" });
      if (doc?.value && typeof doc.value === "object") {
        return { ...DEFAULT_SITE_BRANDING, ...doc.value };
      }
    }
  } catch {
  }
  return DEFAULT_SITE_BRANDING;
}
async function loadStudentsForLinking(incoming) {
  if (Array.isArray(incoming)) return incoming;
  const stored = await selectAppStoreValue("students");
  if (Array.isArray(stored) && stored.length > 0) return stored;
  const merged = await selectMergedTable("students");
  return merged.data || [];
}
async function loadTeachersForLinking(incoming) {
  if (Array.isArray(incoming)) return incoming;
  const stored = await selectAppStoreValue("teachers");
  if (Array.isArray(stored) && stored.length > 0) return stored;
  const merged = await selectMergedTable("teachers");
  return merged.data || [];
}
function pushStoreRow(rows, key, value, updatedAt) {
  if (value === void 0) return;
  if (Array.isArray(value) || value !== null && typeof value === "object") {
    rows.push({ key, value, updated_at: updatedAt });
  }
}
function stripBrandingForStore(branding) {
  return stripOversizedFields(branding);
}
async function resolveSiteBrandingForSync(incoming) {
  if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
    const branding = { ...incoming };
    if (!branding.client_updated_at) {
      branding.client_updated_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    return branding;
  }
  const loaded = await loadSiteBranding();
  return { ...loaded };
}
function mergeSiteBranding(requestBranding, loadedBranding) {
  if (requestBranding && typeof requestBranding === "object") {
    return { ...loadedBranding, ...requestBranding };
  }
  return loadedBranding;
}
async function fetchEmailLogsFromStores() {
  let logs = [];
  try {
    logs = (await selectMergedTable("email_logs")).data;
  } catch {
  }
  try {
    const logStore = await selectAppStoreValue("email_logs");
    if (Array.isArray(logStore)) {
      logs = mergeRecordsById(logs, logStore);
    }
  } catch {
  }
  logs = mergeRecordsById(logs, emailLogs);
  return logs.sort(
    (a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || ""))
  );
}
async function syncEmailLogs(clientLogs) {
  const dbLogs = await fetchEmailLogsFromStores();
  const merged = mergeRecordsById(
    dbLogs,
    Array.isArray(clientLogs) ? clientLogs : []
  ).sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  emailLogs.length = 0;
  emailLogs.push(...merged);
  if (merged.length > 0) {
    await upsertTableWithFailover("email_logs", merged, "id");
  }
  await upsertAppStoreWithFailover([
    { key: "email_logs", value: merged, updated_at: (/* @__PURE__ */ new Date()).toISOString() }
  ]);
  const db = await getMongoDb();
  if (db) {
    await syncMongoCollectionWithDeletes(db, "email_logs", merged);
  }
  return merged;
}
function buildMongoUri() {
  const base = process.env.MONGODB_URI?.trim();
  if (!base) return "";
  if (/retryWrites=/i.test(base)) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}retryWrites=true&w=majority&appName=UniqueSchoolSystem`;
}
var mongoUri = buildMongoUri();
var mongoClient = null;
var dbInstance = null;
var mongoConnectPromise = null;
var mongoLastFailedAt = 0;
var mongoReconnectTimer = null;
var MONGO_RETRY_COOLDOWN_MS = 15e3;
var MONGO_CONNECT_ATTEMPTS = 3;
function scheduleMongoReconnect() {
  if (dbInstance || mongoReconnectTimer) return;
  mongoReconnectTimer = setTimeout(async () => {
    mongoReconnectTimer = null;
    mongoLastFailedAt = 0;
    await getMongoDb().catch(() => void 0);
    if (!dbInstance) scheduleMongoReconnect();
  }, 3e4);
}
async function getMongoDb() {
  if (!mongoUri) return null;
  if (dbInstance) return dbInstance;
  if (Date.now() - mongoLastFailedAt < MONGO_RETRY_COOLDOWN_MS) return null;
  if (mongoConnectPromise) return mongoConnectPromise;
  mongoConnectPromise = (async () => {
    let lastError;
    for (let attempt = 1; attempt <= MONGO_CONNECT_ATTEMPTS; attempt++) {
      try {
        if (mongoClient) {
          try {
            await mongoClient.close();
          } catch {
          }
          mongoClient = null;
        }
        mongoClient = new import_mongodb.MongoClient(mongoUri, {
          connectTimeoutMS: 3e4,
          serverSelectionTimeoutMS: 3e4,
          socketTimeoutMS: 45e3,
          maxPoolSize: 10,
          retryWrites: true,
          retryReads: true
        });
        await mongoClient.connect();
        console.log("[MongoDB Atlas] Connected successfully to Cluster0 for Dynamic Custom Form Fields!");
        dbInstance = mongoClient.db(process.env.MONGODB_DB_NAME || "uschools_db");
        mongoLastFailedAt = 0;
        return dbInstance;
      } catch (err) {
        lastError = err;
        if (attempt < MONGO_CONNECT_ATTEMPTS) {
          console.warn(
            `[MongoDB Atlas] Connection attempt ${attempt}/${MONGO_CONNECT_ATTEMPTS} failed, retrying\u2026`,
            err instanceof Error ? err.message : err
          );
          await new Promise((resolve) => setTimeout(resolve, 2e3 * attempt));
        }
      }
    }
    mongoLastFailedAt = Date.now();
    console.warn("[MongoDB Atlas] Connection failed:", lastError instanceof Error ? lastError.message : lastError);
    scheduleMongoReconnect();
    return null;
  })().finally(() => {
    mongoConnectPromise = null;
  });
  return mongoConnectPromise;
}
function normalizeCustomField(raw) {
  return {
    id: raw.id,
    target: raw.target,
    fieldName: raw.fieldName ?? raw.field_name ?? "",
    fieldType: raw.fieldType ?? raw.field_type ?? "text",
    isRequired: raw.isRequired ?? raw.is_required ?? false
  };
}
async function resolveCustomFieldsForSync(incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return incoming;
  let stored = await selectAppStoreValue("custom_fields");
  if (!Array.isArray(stored) || stored.length === 0) {
    try {
      const merged = await selectMergedTable("custom_fields");
      if (merged.data.length) stored = merged.data;
    } catch {
    }
  }
  return resolveEntityListForStoreWrite(
    stored,
    incoming
  );
}
async function loadCustomFieldsFromStores() {
  let fromTable = [];
  let fromStore = [];
  try {
    const merged = await selectMergedTable("custom_fields");
    if (merged.data.length) {
      fromTable = merged.data.map((row) => normalizeCustomField(row));
    }
  } catch {
  }
  try {
    const storeValue = await selectAppStoreValue("custom_fields");
    if (Array.isArray(storeValue) && storeValue.length > 0) {
      fromStore = storeValue.map((row) => normalizeCustomField(row));
    }
  } catch {
  }
  let customFields = mergePreferLatest(fromTable, fromStore);
  if (customFields.length === 0) {
    const db = await getMongoDb();
    if (db) {
      try {
        const mongoCustomFields = await db.collection("custom_fields").find({}).toArray();
        customFields = mongoCustomFields.map((cf) => {
          const normalized = normalizeCustomField(cf);
          return normalized;
        });
      } catch {
      }
    }
  }
  return customFields;
}
async function persistCustomFieldsToStores(customFields) {
  const errors = [];
  let supabaseOk = false;
  let mongodbOk = false;
  if (!Array.isArray(customFields) || customFields.length === 0) {
    return { supabase: true, mongodb: true, errors: [] };
  }
  try {
    const result = await replaceCustomFieldsWithFailover(customFields);
    if (result.error) errors.push(`Supabase custom_fields: ${result.error}`);
    supabaseOk = result.ok;
  } catch (err) {
    errors.push(`Supabase custom_fields sync: ${err.message}`);
  }
  try {
    const db = await getMongoDb();
    if (db) {
      await db.collection("custom_fields").deleteMany({});
      if (customFields.length > 0) {
        await db.collection("custom_fields").insertMany(customFields.map((cf) => {
          const clean = { ...cf };
          delete clean._id;
          return clean;
        }));
      }
      mongodbOk = true;
    }
  } catch (err) {
    errors.push(`MongoDB custom_fields sync: ${err.message}`);
  }
  return { supabase: supabaseOk, mongodb: mongodbOk, errors };
}
app.post("/api/admin/login", (req, res) => {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    return res.status(503).json({
      success: false,
      error: "Admin login is not configured. Set ADMIN_PASSWORD in your server .env file."
    });
  }
  const password = req.body?.password;
  if (typeof password !== "string" || !password.trim()) {
    return res.status(400).json({ success: false, error: "Password is required." });
  }
  if (password !== configured) {
    return res.status(401).json({ success: false, error: "Invalid password." });
  }
  res.json({ success: true });
});
app.get("/api/db/health", async (_req, res) => {
  const errors = [];
  const supabaseStatus = await checkSupabaseConnectivity();
  const failover = getSupabaseFailoverStatus();
  if (!supabaseStatus.primary) errors.push("Supabase primary: unavailable");
  if (!supabaseStatus.overflow) errors.push("Supabase overflow: unavailable (apply schema if first use)");
  let mongoOk = false;
  try {
    const db = await getMongoDb();
    if (db) {
      await db.command({ ping: 1 });
      mongoOk = true;
    } else {
      errors.push("MongoDB: connection unavailable");
    }
  } catch (err) {
    errors.push(`MongoDB: ${err.message}`);
  }
  res.json({
    ok: supabaseStatus.primary || supabaseStatus.overflow || mongoOk || isCloudinaryConfigured(),
    supabase: supabaseStatus.primary,
    supabaseOverflow: supabaseStatus.overflow,
    mongodb: mongoOk,
    cloudinary: isCloudinaryConfigured(),
    email: getEmailConfig(),
    failover,
    errors: errors.length ? errors : void 0,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/db/schema-status", async (_req, res) => {
  const tables = [
    "students",
    "teachers",
    "fees",
    "payrolls",
    "exam_results",
    "expenses",
    "email_templates",
    "custom_fields",
    "email_logs",
    "student_attendance",
    "teacher_attendance",
    "app_store"
  ];
  const status = {};
  for (const table of tables) {
    const col = table === "app_store" ? "key" : "id";
    const { error } = await supabase.from(table).select(col).limit(1);
    status[table] = !error;
  }
  const ready = Object.values(status).filter(Boolean).length;
  res.json({
    tables: status,
    readyCount: ready,
    totalCount: tables.length,
    allReady: ready === tables.length,
    hint: ready < tables.length ? "Run supabase/schema.sql in Supabase Dashboard \u2192 SQL Editor, or set DATABASE_URL and run npm run db:setup" : "All tables ready"
  });
});
app.get("/api/db/fee-schema-check", async (_req, res) => {
  const requiredColumns = [
    "scheduled_installments",
    "payment_plan",
    "voucher_sent_at",
    "custom_fields"
  ];
  const probeFee = {
    id: "__schema_probe__",
    student_id: "__probe__",
    month: "January",
    year: 2099,
    tuition_fee: 0,
    net_fee: 0,
    paid_amount: 0,
    status: "Unpaid",
    scheduled_installments: [],
    payment_plan: "Full",
    voucher_sent_at: null,
    custom_fields: {}
  };
  const { error } = await supabase.from("fees").upsert([probeFee], { onConflict: "id" });
  if (!error) {
    await supabase.from("fees").delete().eq("id", "__schema_probe__");
  }
  res.json({
    feeColumnsReady: !error,
    requiredColumns,
    error: error?.message ?? null,
    hint: error ? "Run the ALTER TABLE statements for fees in supabase/schema.sql (scheduled_installments, payment_plan, voucher_sent_at, custom_fields). Full fee data is still backed up in app_store." : "All extended fee columns are available in Supabase."
  });
});
app.post("/api/custom-fields/sync", async (req, res) => {
  try {
    const { customFields } = req.body || {};
    if (!Array.isArray(customFields)) {
      return res.status(400).json({ success: false, error: "customFields array is required" });
    }
    const persist = await persistCustomFieldsToStores(customFields);
    res.json({
      success: persist.supabase || persist.mongodb,
      supabase: persist.supabase,
      mongodb: persist.mongodb,
      errors: persist.errors.length ? persist.errors : void 0,
      customFields
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/custom-fields", async (_req, res) => {
  try {
    const customFields = await loadCustomFieldsFromStores();
    res.json({ success: true, customFields, count: customFields.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/custom-fields/verify", async (_req, res) => {
  try {
    const customFields = await loadCustomFieldsFromStores();
    const testField = {
      id: "verify-" + Date.now(),
      target: "student",
      fieldName: "__verify_field__",
      fieldType: "text",
      isRequired: false
    };
    const withTest = [...customFields.filter((f) => f.id !== testField.id && f.fieldName !== testField.fieldName), testField];
    const persist = await persistCustomFieldsToStores(withTest);
    const reloaded = await loadCustomFieldsFromStores();
    const found = reloaded.some((f) => f.id === testField.id);
    await persistCustomFieldsToStores(customFields);
    res.json({
      success: persist.supabase || persist.mongodb,
      supabase: persist.supabase,
      mongodb: persist.mongodb,
      loadedCount: customFields.length,
      writeReadOk: found,
      errors: persist.errors,
      stores: {
        supabaseTable: "custom_fields",
        supabaseAppStore: "app_store.custom_fields",
        mongodbCollection: "custom_fields"
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/custom-fields", async (req, res) => {
  try {
    const field = normalizeCustomField(req.body || {});
    if (!field.id || !field.fieldName || !field.target) {
      return res.status(400).json({ success: false, error: "id, target, and fieldName are required" });
    }
    const existing = await loadCustomFieldsFromStores();
    if (existing.some((f) => f.id === field.id)) {
      return res.status(409).json({ success: false, error: "Field id already exists" });
    }
    const next = [...existing, field];
    const persist = await persistCustomFieldsToStores(next);
    res.json({ success: persist.supabase || persist.mongodb, customFields: next, persist });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put("/api/custom-fields/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = normalizeCustomField({ ...req.body, id });
    const existing = await loadCustomFieldsFromStores();
    const index = existing.findIndex((f) => f.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: "Field not found" });
    }
    const next = existing.map((f) => f.id === id ? { ...f, ...updates, id } : f);
    const persist = await persistCustomFieldsToStores(next);
    res.json({ success: persist.supabase || persist.mongodb, customFields: next, persist });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/api/custom-fields/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await loadCustomFieldsFromStores();
    const next = existing.filter((f) => f.id !== id);
    if (next.length === existing.length) {
      return res.status(404).json({ success: false, error: "Field not found" });
    }
    const persist = await persistCustomFieldsToStores(next);
    res.json({ success: persist.supabase || persist.mongodb, customFields: next, persist });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/db/all", async (req, res) => {
  const loadStarted = Date.now();
  try {
    let students = [];
    let teachers = [];
    let fees = [];
    let payrolls = [];
    let examResults = [];
    let expenses = [];
    let emailTemplates = [];
    let logs = [];
    let customFields = [];
    let studentAttendance = [];
    let teacherAttendance = [];
    let schoolFeeSettings = null;
    let siteBranding = null;
    let storeMap = {};
    let syncSequence = 0;
    let supabaseConnected = false;
    let mongoConnected = false;
    try {
      const [
        stMerged,
        teachersMerged,
        feesMerged,
        payrollsMerged,
        examResultsMerged,
        expensesMerged,
        emailTemplatesMerged,
        cfMerged,
        studentAttendanceMerged,
        teacherAttendanceMerged,
        logsMerged,
        storeMapResult
      ] = await Promise.all([
        selectMergedTable("students"),
        selectMergedTable("teachers"),
        selectMergedTable("fees"),
        selectMergedTable("payrolls"),
        selectMergedTable("exam_results"),
        selectMergedTable("expenses"),
        selectMergedTable("email_templates"),
        selectMergedTable("custom_fields"),
        selectMergedTable("student_attendance"),
        selectMergedTable("teacher_attendance"),
        selectMergedTable("email_logs"),
        loadMergedAppStoreMap()
      ]);
      if (stMerged.primaryOk || stMerged.overflowOk) supabaseConnected = true;
      students = stMerged.data;
      teachers = teachersMerged.data;
      fees = feesMerged.data;
      payrolls = payrollsMerged.data;
      examResults = examResultsMerged.data;
      expenses = expensesMerged.data;
      emailTemplates = emailTemplatesMerged.data;
      if (cfMerged.data.length > 0) {
        customFields = cfMerged.data.map((row) => normalizeCustomField(row));
      }
      studentAttendance = studentAttendanceMerged.data;
      teacherAttendance = teacherAttendanceMerged.data;
      logs = logsMerged.data;
      if (logs.length === 0) {
        const logStore = await selectAppStoreValue("email_logs");
        if (Array.isArray(logStore)) logs = logStore;
      }
      storeMap = storeMapResult;
      const rawSeq = storeMap.sync_sequence;
      if (typeof rawSeq === "number") syncSequence = rawSeq;
      else if (typeof rawSeq === "string" && rawSeq.trim()) syncSequence = Number(rawSeq) || 0;
      if (Object.keys(storeMap).length > 0) {
        students = mergeEntityListForFetch(students, storeMap.students);
        teachers = mergeEntityListForFetch(teachers, storeMap.teachers);
        fees = mergeEntityListForFetch(fees, storeMap.fees);
        payrolls = mergeEntityListForFetch(payrolls, storeMap.payrolls);
        examResults = mergeEntityListForFetch(examResults, storeMap.exam_results);
        expenses = mergeEntityListForFetch(expenses, storeMap.expenses);
        emailTemplates = mergeEntityListForFetch(emailTemplates, storeMap.email_templates);
        if (Array.isArray(storeMap.custom_fields)) {
          customFields = storeMap.custom_fields.map((r) => normalizeCustomField(r));
        }
        studentAttendance = mergeEntityListForFetch(studentAttendance, storeMap.student_attendance);
        teacherAttendance = mergeEntityListForFetch(teacherAttendance, storeMap.teacher_attendance);
        if (storeMap.school_fee_settings) schoolFeeSettings = storeMap.school_fee_settings;
        if (storeMap.site_branding && typeof storeMap.site_branding === "object") {
          siteBranding = { ...DEFAULT_SITE_BRANDING, ...storeMap.site_branding };
        }
      }
      logs = mergeRecordsById(logs, storeMap.email_logs, emailLogs).sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
    } catch (supaErr) {
      console.warn("Supabase query note:", supaErr);
    }
    const db = await getMongoDb();
    if (db) {
      try {
        mongoConnected = true;
        if (customFields.length === 0) {
          const mongoCustomFields = await db.collection("custom_fields").find({}).toArray();
          customFields = mongoCustomFields.map((cf) => normalizeCustomField(cf));
        }
        if (students.length === 0) {
          const st = await db.collection("students").find({}).toArray();
          students = st.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
        if (teachers.length === 0) {
          const tc = await db.collection("teachers").find({}).toArray();
          teachers = tc.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
        if (fees.length === 0) {
          const fe = await db.collection("fees").find({}).toArray();
          fees = fe.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
        if (payrolls.length === 0) {
          const pr = await db.collection("payrolls").find({}).toArray();
          payrolls = pr.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
        if (examResults.length === 0) {
          const ex = await db.collection("exam_results").find({}).toArray();
          examResults = ex.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
        if (expenses.length === 0) {
          const exp = await db.collection("expenses").find({}).toArray();
          expenses = exp.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
        if (emailTemplates.length === 0) {
          const tpl = await db.collection("email_templates").find({}).toArray();
          emailTemplates = tpl.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
        if (studentAttendance.length === 0) {
          const sa = await db.collection("student_attendance").find({}).toArray();
          studentAttendance = sa.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
        if (teacherAttendance.length === 0) {
          const ta = await db.collection("teacher_attendance").find({}).toArray();
          teacherAttendance = ta.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
        const cleanMongoRow = (row) => {
          const copy = { ...row };
          delete copy._id;
          return copy;
        };
        const [mongoStoreStudents, mongoStoreTeachers, mongoStudentRows, mongoTeacherRows] = await Promise.all([
          db.collection("app_store").findOne({ key: "students" }),
          db.collection("app_store").findOne({ key: "teachers" }),
          db.collection("students").find({}).toArray(),
          db.collection("teachers").find({}).toArray()
        ]);
        if (Array.isArray(mongoStoreStudents?.value)) {
          students = mergeEntityListsWithDocuments(students, mongoStoreStudents.value);
        }
        if (Array.isArray(mongoStoreTeachers?.value)) {
          teachers = mergeEntityListsWithDocuments(teachers, mongoStoreTeachers.value);
        }
        if (mongoStudentRows.length) {
          students = mergeEntityListsWithDocuments(
            students,
            mongoStudentRows.map((row) => cleanMongoRow(row))
          );
        }
        if (mongoTeacherRows.length) {
          teachers = mergeEntityListsWithDocuments(
            teachers,
            mongoTeacherRows.map((row) => cleanMongoRow(row))
          );
        }
        if (!schoolFeeSettings) {
          const sfDoc = await db.collection("app_store").findOne({ key: "school_fee_settings" });
          if (sfDoc?.value) schoolFeeSettings = sfDoc.value;
        }
        if (!siteBranding) {
          const sbDoc = await db.collection("app_store").findOne({ key: "site_branding" });
          if (sbDoc?.value && typeof sbDoc.value === "object") {
            siteBranding = { ...DEFAULT_SITE_BRANDING, ...sbDoc.value };
          }
        }
        if (logs.length === 0) {
          const mongoLogs = await db.collection("email_logs").find({}).toArray();
          logs = mongoLogs.map((x) => {
            const c = { ...x };
            delete c._id;
            return c;
          });
        }
      } catch (mongoErr) {
        console.warn("MongoDB custom fields fetch note:", mongoErr);
      }
    }
    res.json({
      connected: supabaseConnected || mongoConnected,
      supabase: supabaseConnected,
      mongodb: mongoConnected,
      failover: getSupabaseFailoverStatus(),
      loadMs: Date.now() - loadStarted,
      counts: {
        students: students.length,
        teachers: teachers.length,
        fees: fees.length,
        payrolls: payrolls.length,
        examResults: examResults.length,
        expenses: expenses.length,
        customFields: customFields.length,
        emailLogs: (logs.length > 0 ? logs : emailLogs).length
      },
      data: {
        students,
        teachers,
        fees,
        payrolls,
        examResults,
        customFields,
        expenses,
        emailTemplates,
        studentAttendance,
        teacherAttendance,
        schoolFeeSettings,
        siteBranding,
        emailLogs: logs.length > 0 ? logs : emailLogs
      },
      syncSequence
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/db/sync", async (req, res) => {
  if (activeDbSync) {
    try {
      await activeDbSync;
    } catch {
    }
  }
  const syncJob = (async () => {
    try {
      const {
        students,
        teachers,
        fees,
        payrolls,
        examResults,
        customFields,
        expenses,
        emailTemplates,
        studentAttendance,
        teacherAttendance,
        schoolFeeSettings,
        siteBranding,
        emailLogs: clientEmailLogs,
        syncSequence: incomingSyncSequence
      } = req.body;
      const syncStatus = { supabase: false, mongodb: false, errors: [] };
      let mergedEmailLogs = [];
      const storeUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const storedSyncSequenceRaw = await selectAppStoreValue("sync_sequence");
      const storedSyncSequence = typeof storedSyncSequenceRaw === "number" ? storedSyncSequenceRaw : Number(storedSyncSequenceRaw ?? 0) || 0;
      const incomingSyncSequenceNum = typeof incomingSyncSequence === "number" ? incomingSyncSequence : Number(incomingSyncSequence ?? storedSyncSequence) || storedSyncSequence;
      const nextSyncSequence = Math.max(storedSyncSequence, incomingSyncSequenceNum) + 1;
      const resolvedSiteBranding = await resolveSiteBrandingForSync(siteBranding);
      const storedSchoolFeeSettings = await selectAppStoreValue("school_fee_settings");
      const resolvedSchoolFeeSettings = resolveSchoolFeeSettingsForStoreWrite(
        storedSchoolFeeSettings,
        schoolFeeSettings && typeof schoolFeeSettings === "object" ? schoolFeeSettings : null
      );
      let resolvedCustomFields;
      if (Array.isArray(customFields)) {
        resolvedCustomFields = await resolveCustomFieldsForSync(customFields);
      }
      const storeUpdatedAtBranding = storeUpdatedAt;
      if (siteBranding !== void 0 || resolvedSiteBranding) {
        const brandingResult = await upsertAppStoreKeyWithFailover(
          "site_branding",
          stripBrandingForStore(resolvedSiteBranding),
          storeUpdatedAtBranding
        );
        if (!brandingResult.ok && brandingResult.error) {
          syncStatus.errors.push(`Supabase app_store site_branding: ${brandingResult.error}`);
        } else if (brandingResult.ok) {
          syncStatus.supabase = true;
        }
      }
      if (resolvedSchoolFeeSettings) {
        const feeSettingsResult = await upsertAppStoreKeyWithFailover(
          "school_fee_settings",
          resolvedSchoolFeeSettings,
          storeUpdatedAt
        );
        if (feeSettingsResult.ok) syncStatus.supabase = true;
        else if (feeSettingsResult.error) {
          syncStatus.errors.push(`Supabase app_store school_fee_settings: ${feeSettingsResult.error}`);
        }
      }
      if (Array.isArray(resolvedCustomFields) && resolvedCustomFields.length > 0) {
        const cfEarly = await persistCustomFieldsToStores(resolvedCustomFields);
        if (cfEarly.errors.length) syncStatus.errors.push(...cfEarly.errors);
        if (cfEarly.supabase) syncStatus.supabase = true;
        if (cfEarly.mongodb) syncStatus.mongodb = true;
      }
      let resolvedStudents = students;
      let resolvedTeachers = teachers;
      let resolvedFees = fees;
      let resolvedPayrolls = payrolls;
      let resolvedExamResults = examResults;
      let resolvedExpenses = expenses;
      let resolvedEmailTemplates = emailTemplates;
      let resolvedStudentAttendance = studentAttendance;
      let resolvedTeacherAttendance = teacherAttendance;
      if (Array.isArray(students)) {
        resolvedStudents = await persistEntityListEarly(
          "students",
          students,
          storeUpdatedAt,
          syncStatus
        ) ?? resolvedStudents;
      }
      if (Array.isArray(teachers)) {
        resolvedTeachers = await persistEntityListEarly(
          "teachers",
          teachers,
          storeUpdatedAt,
          syncStatus
        ) ?? resolvedTeachers;
      }
      if (Array.isArray(fees)) {
        resolvedFees = await persistEntityListEarly(
          "fees",
          fees,
          storeUpdatedAt,
          syncStatus
        ) ?? resolvedFees;
      }
      if (Array.isArray(payrolls)) {
        resolvedPayrolls = await persistEntityListEarly(
          "payrolls",
          payrolls,
          storeUpdatedAt,
          syncStatus
        ) ?? resolvedPayrolls;
      }
      if (Array.isArray(expenses)) {
        resolvedExpenses = await persistEntityListEarly(
          "expenses",
          expenses,
          storeUpdatedAt,
          syncStatus
        ) ?? resolvedExpenses;
      }
      if (Array.isArray(emailTemplates)) {
        resolvedEmailTemplates = await persistEntityListEarly(
          "email_templates",
          emailTemplates,
          storeUpdatedAt,
          syncStatus
        ) ?? resolvedEmailTemplates;
      }
      if (Array.isArray(studentAttendance)) {
        resolvedStudentAttendance = await persistEntityListEarly(
          "student_attendance",
          studentAttendance,
          storeUpdatedAt,
          syncStatus
        ) ?? resolvedStudentAttendance;
      }
      if (Array.isArray(teacherAttendance)) {
        resolvedTeacherAttendance = await persistEntityListEarly(
          "teacher_attendance",
          teacherAttendance,
          storeUpdatedAt,
          syncStatus
        ) ?? resolvedTeacherAttendance;
      }
      if (Array.isArray(examResults)) {
        resolvedExamResults = await persistEntityListEarly(
          "exam_results",
          examResults,
          storeUpdatedAt,
          syncStatus
        ) ?? resolvedExamResults;
      }
      const studentsForLink = await loadStudentsForLinking(students);
      const teachersForLink = await loadTeachersForLinking(teachers);
      try {
        let supaTableOk = false;
        if (Array.isArray(students)) {
          supaTableOk = await syncSupabaseTableWithDeletes("students", resolvedStudents, normalizeStudentsForDb) || supaTableOk;
        }
        if (Array.isArray(teachers)) {
          supaTableOk = await syncSupabaseTableWithDeletes("teachers", resolvedTeachers, normalizeTeachersForDb) || supaTableOk;
        }
        if (Array.isArray(fees)) {
          supaTableOk = await syncSupabaseTableWithDeletes("fees", resolvedFees, normalizeFeesForDb) || supaTableOk;
        }
        if (Array.isArray(payrolls)) {
          supaTableOk = await syncSupabaseTableWithDeletes("payrolls", resolvedPayrolls, normalizePayrollsForDb) || supaTableOk;
        }
        if (Array.isArray(examResults)) {
          supaTableOk = await syncSupabaseTableWithDeletes(
            "exam_results",
            resolvedExamResults,
            (rows) => resolveExamResultsForDbSync(rows, studentsForLink)
          ) || supaTableOk;
        }
        if (Array.isArray(expenses)) {
          supaTableOk = await syncSupabaseTableWithDeletes("expenses", resolvedExpenses, normalizeExpensesForDb) || supaTableOk;
        }
        if (Array.isArray(emailTemplates)) {
          supaTableOk = await syncSupabaseTableWithDeletes("email_templates", resolvedEmailTemplates, normalizeEmailTemplatesForDb) || supaTableOk;
        }
        if (Array.isArray(studentAttendance)) {
          const primaryStudentIds = await selectPrimaryTableIds("students");
          supaTableOk = await syncSupabaseTableWithDeletes(
            "student_attendance",
            resolvedStudentAttendance,
            (rows) => resolveStudentAttendanceForDbSync(rows, studentsForLink, primaryStudentIds)
          ) || supaTableOk;
        }
        if (Array.isArray(teacherAttendance)) {
          const primaryTeacherIds = await selectPrimaryTableIds("teachers");
          supaTableOk = await syncSupabaseTableWithDeletes(
            "teacher_attendance",
            resolvedTeacherAttendance,
            (rows) => resolveTeacherAttendanceForDbSync(rows, teachersForLink, primaryTeacherIds)
          ) || supaTableOk;
        }
        if (Array.isArray(clientEmailLogs)) {
          mergedEmailLogs = await syncEmailLogs(clientEmailLogs);
        }
        const storeUpdatedAtFinal = (/* @__PURE__ */ new Date()).toISOString();
        const storeRows = [];
        if (Array.isArray(students)) {
          pushStoreRow(storeRows, "students", stripEntityListForStore(resolvedStudents), storeUpdatedAtFinal);
        }
        if (Array.isArray(teachers)) {
          pushStoreRow(storeRows, "teachers", stripEntityListForStore(resolvedTeachers), storeUpdatedAtFinal);
        }
        if (Array.isArray(fees)) {
          pushStoreRow(storeRows, "fees", stripEntityListForStore(resolvedFees), storeUpdatedAtFinal);
        }
        if (Array.isArray(payrolls)) {
          pushStoreRow(storeRows, "payrolls", stripEntityListForStore(resolvedPayrolls), storeUpdatedAtFinal);
        }
        if (Array.isArray(examResults)) {
          pushStoreRow(storeRows, "exam_results", stripEntityListForStore(resolvedExamResults), storeUpdatedAtFinal);
        }
        if (Array.isArray(resolvedCustomFields) && resolvedCustomFields.length > 0) {
          pushStoreRow(storeRows, "custom_fields", resolvedCustomFields, storeUpdatedAtFinal);
        }
        if (Array.isArray(expenses)) {
          pushStoreRow(storeRows, "expenses", stripEntityListForStore(resolvedExpenses), storeUpdatedAtFinal);
        }
        if (Array.isArray(emailTemplates)) {
          pushStoreRow(storeRows, "email_templates", stripEntityListForStore(resolvedEmailTemplates), storeUpdatedAtFinal);
        }
        if (Array.isArray(studentAttendance)) {
          pushStoreRow(storeRows, "student_attendance", stripEntityListForStore(resolvedStudentAttendance), storeUpdatedAtFinal);
        }
        if (Array.isArray(teacherAttendance)) {
          pushStoreRow(storeRows, "teacher_attendance", stripEntityListForStore(resolvedTeacherAttendance), storeUpdatedAtFinal);
        }
        if (resolvedSchoolFeeSettings) {
          pushStoreRow(storeRows, "school_fee_settings", resolvedSchoolFeeSettings, storeUpdatedAtFinal);
        }
        if (mergedEmailLogs.length > 0) {
          pushStoreRow(storeRows, "email_logs", mergedEmailLogs, storeUpdatedAtFinal);
        } else if (Array.isArray(clientEmailLogs)) {
          pushStoreRow(storeRows, "email_logs", clientEmailLogs, storeUpdatedAtFinal);
        }
        storeRows.push({
          key: "sync_sequence",
          value: nextSyncSequence,
          updated_at: storeUpdatedAt
        });
        let storeOk = true;
        if (storeRows.length > 0) {
          const storeResult = await upsertAppStoreWithFailover(storeRows);
          if (!storeResult.ok && storeResult.error) {
            storeOk = false;
            syncStatus.errors.push(`Supabase app_store: ${storeResult.error}`);
          }
        }
        if (supaTableOk || storeOk) {
          syncStatus.supabase = true;
        }
      } catch (supaSyncErr) {
        syncStatus.errors.push(`Supabase sync: ${supaSyncErr.message}`);
        console.warn("Supabase sync note:", supaSyncErr);
      }
      if (Array.isArray(resolvedCustomFields)) {
        const cfPersist = await persistCustomFieldsToStores(resolvedCustomFields);
        if (cfPersist.errors.length) syncStatus.errors.push(...cfPersist.errors);
        if (cfPersist.supabase) syncStatus.supabase = true;
        if (cfPersist.mongodb) syncStatus.mongodb = true;
      }
      try {
        const db = await getMongoDb();
        if (db) {
          if (Array.isArray(resolvedStudents)) await syncMongoCollectionWithDeletes(db, "students", resolvedStudents);
          if (Array.isArray(resolvedTeachers)) await syncMongoCollectionWithDeletes(db, "teachers", resolvedTeachers);
          if (Array.isArray(resolvedFees)) await syncMongoCollectionWithDeletes(db, "fees", resolvedFees);
          if (Array.isArray(resolvedPayrolls)) await syncMongoCollectionWithDeletes(db, "payrolls", resolvedPayrolls);
          if (Array.isArray(resolvedExamResults)) await syncMongoCollectionWithDeletes(db, "exam_results", resolvedExamResults);
          if (Array.isArray(resolvedExpenses)) await syncMongoCollectionWithDeletes(db, "expenses", resolvedExpenses);
          if (Array.isArray(resolvedEmailTemplates)) await syncMongoCollectionWithDeletes(db, "email_templates", resolvedEmailTemplates);
          if (Array.isArray(resolvedStudentAttendance)) await syncMongoCollectionWithDeletes(db, "student_attendance", resolvedStudentAttendance);
          if (Array.isArray(resolvedTeacherAttendance)) await syncMongoCollectionWithDeletes(db, "teacher_attendance", resolvedTeacherAttendance);
          if (resolvedSchoolFeeSettings) {
            await persistMongoAppStore(db, "school_fee_settings", resolvedSchoolFeeSettings);
          }
          if (siteBranding !== void 0 || resolvedSiteBranding) {
            await persistMongoAppStore(db, "site_branding", resolvedSiteBranding);
          }
          if (Array.isArray(resolvedStudents)) await persistMongoAppStore(db, "students", resolvedStudents);
          if (Array.isArray(resolvedTeachers)) await persistMongoAppStore(db, "teachers", resolvedTeachers);
          if (Array.isArray(resolvedFees)) await persistMongoAppStore(db, "fees", resolvedFees);
          if (Array.isArray(resolvedPayrolls)) await persistMongoAppStore(db, "payrolls", resolvedPayrolls);
          if (Array.isArray(resolvedExamResults)) await persistMongoAppStore(db, "exam_results", resolvedExamResults);
          if (Array.isArray(resolvedExpenses)) await persistMongoAppStore(db, "expenses", resolvedExpenses);
          if (Array.isArray(resolvedEmailTemplates)) await persistMongoAppStore(db, "email_templates", resolvedEmailTemplates);
          if (Array.isArray(resolvedStudentAttendance)) await persistMongoAppStore(db, "student_attendance", resolvedStudentAttendance);
          if (Array.isArray(resolvedTeacherAttendance)) await persistMongoAppStore(db, "teacher_attendance", resolvedTeacherAttendance);
          syncStatus.mongodb = true;
        }
      } catch (mongoSyncErr) {
        syncStatus.errors.push(`MongoDB sync: ${mongoSyncErr.message}`);
        console.warn("MongoDB sync note:", mongoSyncErr);
      }
      if (mergedEmailLogs.length === 0) {
        mergedEmailLogs = await fetchEmailLogsFromStores();
      }
      return {
        success: syncStatus.supabase || syncStatus.mongodb,
        supabase: syncStatus.supabase,
        mongodb: syncStatus.mongodb,
        syncSequence: nextSyncSequence,
        failover: getSupabaseFailoverStatus(),
        errors: syncStatus.errors.length > 0 ? syncStatus.errors : void 0,
        emailLogs: mergedEmailLogs,
        ...Array.isArray(students) ? { students: stripEntityListForStore(resolvedStudents) } : {},
        ...Array.isArray(teachers) ? { teachers: stripEntityListForStore(resolvedTeachers) } : {},
        message: syncStatus.supabase || syncStatus.mongodb ? "All application data successfully persisted in Supabase database! Dynamic form fields managed via MongoDB." : "Sync completed with warnings \u2014 check errors array."
      };
    } catch (err) {
      console.error("Data sync error:", err);
      throw err;
    }
  })();
  activeDbSync = syncJob;
  try {
    const result = await syncJob;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (activeDbSync === syncJob) activeDbSync = null;
  }
});
app.post("/api/email/send-test", async (req, res) => {
  try {
    const { recipientEmail, subject, headerTitle, body, footer, accentColor, siteBranding } = req.body;
    if (!recipientEmail) {
      return res.status(400).json({ error: "Recipient email address is required." });
    }
    const fromEmail = process.env.SMTP_FROM_EMAIL || "uschools.pk@gmail.com";
    const fromName = process.env.SMTP_FROM_NAME || "Unique School System";
    const branding = mergeSiteBranding(siteBranding, await loadSiteBranding());
    const htmlContent = buildBrandedEmailHtml({
      headerTitle: headerTitle || branding.school_name,
      body: body || "This is a test preview email dispatched from Unique School System.",
      footer: footer || branding.footer_subtitle,
      accentColor,
      branding,
      isPlainTextBody: true,
      headerBadge: "Template System Preview Dispatch"
    });
    const sendResult = await sendTransactionalEmail({
      to: recipientEmail,
      subject: subject || "Test Email Template Preview",
      text: body,
      html: htmlContent
    });
    const status = sendResult.status === "Success" ? "Success" : sendResult.status;
    res.json({
      success: sendResult.status !== "Failed",
      status,
      channel: sendResult.channel,
      error: sendResult.error,
      message: status === "Success" ? `Test email dispatched successfully to ${recipientEmail}!` : sendResult.error || `Email delivery ${String(status).toLowerCase()}. Target: ${recipientEmail}`
    });
  } catch (err) {
    console.error("Test email dispatch error:", err);
    res.status(500).json({ error: err.message || "Failed to dispatch test email." });
  }
});
app.post("/api/email/dispatch-progress-report", async (req, res) => {
  try {
    const { student, termName, pdfBase64, customSubject, attachmentFilename, customRecipientEmail, customNote, siteBranding } = req.body;
    if (!student) {
      return res.status(400).json({ error: "Student record is required." });
    }
    const isOrphan = Boolean(student.is_orphan);
    let recipientEmail = "";
    let recipientName = "";
    let recipientType = "Guardian";
    if (isOrphan) {
      recipientEmail = student.donor_email || student.guardian_email || "donor@example.com";
      recipientName = student.donor_name || "Honorable Sponsor";
      recipientType = "Donor";
    } else {
      recipientEmail = student.guardian_email || student.parent_email || "guardian@example.com";
      recipientName = student.guardian_name || student.father_name || "Respected Parent";
      recipientType = "Guardian";
    }
    if (customRecipientEmail && String(customRecipientEmail).includes("@")) {
      recipientEmail = customRecipientEmail;
    }
    const effectiveTerm = termName || "1st Term Examination 2026";
    const isProfileShare = Boolean(attachmentFilename);
    const subject = customSubject || (isProfileShare ? `Student Profile - ${student.full_name} (${student.roll_no})` : `Student Progress Report - Unique School System`);
    const bodyText = customNote || (isProfileShare ? (() => {
      const docCount = collectProfileDocumentSources(student, "student").length;
      const galleryLine = docCount > 0 ? `

This package also includes ${docCount} document(s) from the student Document Gallery (scans, certificates, and uploaded files).` : "";
      return `Respected (Mr / Miss) ${recipientName},
Assalam o Alaikum

Please find attached the verified student profile for ${student.full_name} (${student.roll_no}).${galleryLine}

Warm Regards,
Abdul Rehman Jamil
Unique School System`;
    })() : `Respected (Mr / Miss) ${recipientName},
Assalam o Alaikum

We hope this message finds you in good health and high spirits.

Please find attached progress report(s) of your sponsored student(s) for [${effectiveTerm}]. We sincerely appreciate your continued support to Unique School System for this genuine cause to educate orphan/in-need students.

JazakAllah u Khairan

Warm Regards,
Abdul Rehman Jamil
Unique School System`);
    const fromEmail = process.env.SMTP_FROM_EMAIL || "uschools.pk@gmail.com";
    const fromName = process.env.SMTP_FROM_NAME || "Unique School System";
    const branding = mergeSiteBranding(siteBranding, await loadSiteBranding());
    const htmlContent = buildBrandedEmailHtml({
      headerTitle: isProfileShare ? "Student Profile Package" : "Academic Progress Report",
      body: bodyText,
      footer: branding.footer_subtitle,
      branding,
      isPlainTextBody: true
    });
    const attachments = [];
    if (pdfBase64) {
      const pdfFilename = attachmentFilename || `${student.roll_no}_Progress_Report_${effectiveTerm.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      attachments.push({
        filename: pdfFilename,
        content: pdfBase64.split(",")[1] || pdfBase64,
        encoding: "base64"
      });
      if (isProfileShare) {
        const galleryAttachments = await buildProfileDocumentGalleryAttachments(
          student,
          "student",
          student.roll_no || student.id || "Student"
        );
        attachments.push(...galleryAttachments);
      }
    }
    const sendResult = await sendTransactionalEmail({
      to: recipientEmail,
      subject,
      text: bodyText,
      html: htmlContent,
      attachments: attachments.length ? attachments : void 0
    });
    const mailStatus = sendResult.status === "Success" ? "Success" : sendResult.status;
    const logEntry = {
      id: "log-" + Date.now(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      recipient_email: recipientEmail,
      recipient_type: recipientType,
      recipient_name: recipientName,
      student_name: student.full_name,
      subject,
      term_name: effectiveTerm,
      status: mailStatus,
      attachment_name: attachmentFilename || `${student.roll_no}_Report.pdf`
    };
    await persistEmailLog(logEntry);
    res.json({
      success: true,
      status: mailStatus,
      recipientEmail,
      recipientName,
      recipientType,
      log: logEntry,
      message: mailStatus === "Success" ? `Progress report dispatched successfully via Brevo SMTP to ${recipientEmail}` : `Progress report dispatched in simulated mode to ${recipientEmail} (${recipientType}: ${recipientName})`
    });
  } catch (error) {
    console.error("Error dispatching Brevo SMTP email:", error);
    res.status(500).json({ error: error.message || "Failed to send Brevo email." });
  }
});
app.post("/api/email/dispatch-fee-reminder", async (req, res) => {
  try {
    const { student, feeMonth, amountDue, isPaidReceipt, pdfBase64, dueDate, isVoucher, attachmentFilename, siteBranding } = req.body;
    if (!student) {
      return res.status(400).json({ error: "Student record required." });
    }
    const isOrphan = Boolean(student.is_orphan);
    let recipientEmail = "";
    let recipientName = "";
    let recipientType = "Guardian";
    if (isOrphan) {
      recipientEmail = student.donor_email || student.guardian_email || "donor@example.com";
      recipientName = student.donor_name || "Honorable Sponsor";
      recipientType = "Donor";
    } else {
      recipientEmail = student.guardian_email || student.parent_email || "guardian@example.com";
      recipientName = student.guardian_name || student.father_name || "Respected Parent";
      recipientType = "Guardian";
    }
    const subject = isPaidReceipt ? `Official Fee Payment Receipt - ${student.full_name} (${feeMonth})` : isVoucher ? `Official Fee Voucher - ${student.full_name} (${feeMonth})` : `Fee Payment Reminder Notice - ${student.full_name} (${feeMonth})`;
    const dueDateLine = dueDate ? `
Payment Due Date: ${dueDate}` : "";
    const bodyText = isPaidReceipt ? `Respected ${recipientName},
Assalam o Alaikum

This is an official payment confirmation receipt from Unique School System.
We have received the fee payment for ${student.full_name} for the period [${feeMonth}].

Student Roll No: ${student.roll_no}
Class: ${student.class_name}

Thank you for your prompt payment and continued support!

Warm Regards,
Abdul Rehman Jamil
Principal, Unique School System` : isVoucher ? `Respected ${recipientName},
Assalam o Alaikum

Please find attached the official fee voucher for ${student.full_name} for the period [${feeMonth}].

Student Roll No: ${student.roll_no}
Class: ${student.class_name}
Outstanding Amount Due: PKR ${Number(amountDue || 0).toLocaleString()}${dueDateLine}

Kindly deposit the fee using the bank account details shown on the attached voucher. Mention the student roll number in your transfer reference.

Warm Regards,
Abdul Rehman Jamil
Principal, Unique School System` : `Respected ${recipientName},
Assalam o Alaikum

This is a gentle reminder from Unique School System regarding pending fee dues for ${student.full_name} for the period [${feeMonth}].

Student Roll No: ${student.roll_no}
Class: ${student.class_name}
Outstanding Amount Due: PKR ${Number(amountDue || 0).toLocaleString()}${dueDateLine}

Kindly deposit the outstanding amount at your earliest convenience to maintain smooth academic operations.

Warm Regards,
Abdul Rehman Jamil
Principal, Unique School System`;
    const fromEmail = process.env.SMTP_FROM_EMAIL || "uschools.pk@gmail.com";
    const fromName = process.env.SMTP_FROM_NAME || "Unique School System";
    const branding = mergeSiteBranding(siteBranding, await loadSiteBranding());
    const htmlContent = buildBrandedEmailHtml({
      headerTitle: isPaidReceipt ? "Fee Payment Receipt" : isVoucher ? "Official Fee Voucher" : "Fee Payment Reminder",
      body: bodyText,
      footer: branding.footer_subtitle,
      branding,
      isPlainTextBody: true
    });
    const feeAttachments = [];
    if (pdfBase64) {
      const pdfFilename = attachmentFilename || (isVoucher ? `${student.roll_no}_Fee_Voucher_${feeMonth.replace(/[^a-zA-Z0-9]/g, "_")}.pdf` : `${student.roll_no}_Fee_Receipt_${feeMonth.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
      feeAttachments.push({
        filename: pdfFilename,
        content: pdfBase64.split(",")[1] || pdfBase64,
        encoding: "base64"
      });
    }
    const feeSend = await sendTransactionalEmail({
      to: recipientEmail,
      subject,
      text: bodyText,
      html: htmlContent,
      attachments: feeAttachments.length ? feeAttachments : void 0
    });
    const mailStatus = feeSend.status === "Success" ? "Success" : feeSend.status;
    const logEntry = {
      id: "fee-log-" + Date.now(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      recipient_email: recipientEmail,
      recipient_type: recipientType,
      recipient_name: recipientName,
      student_name: student.full_name,
      subject,
      term_name: feeMonth,
      status: mailStatus,
      attachment_name: isPaidReceipt ? `${student.roll_no}_Fee_Receipt.pdf` : "Notice"
    };
    await persistEmailLog(logEntry);
    res.json({
      success: true,
      status: mailStatus,
      recipientEmail,
      recipientName,
      recipientType,
      message: mailStatus === "Success" ? `Email successfully sent to ${recipientEmail}` : `Simulated dispatch: email notification queued for ${recipientEmail}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/email/dispatch-salary-slip", async (req, res) => {
  try {
    const { teacher, payroll, pdfBase64, siteBranding } = req.body;
    if (!teacher) {
      return res.status(400).json({ error: "Teacher record required." });
    }
    const recipientEmail = teacher.email || "teacher@example.com";
    const recipientName = teacher.full_name;
    const monthYear = payroll ? `${payroll.month} ${payroll.year}` : "Current Month";
    const subject = `Official Salary Disbursement Slip - ${monthYear} (${teacher.full_name})`;
    const bodyText = `Respected ${recipientName},
Assalam o Alaikum

Your salary for [${monthYear}] has been successfully processed and disbursed by Unique School System Accounts.

Employee ID: ${teacher.teacher_id}
Designation: ${teacher.designation}
Net Salary Amount: PKR ${Number(payroll?.net_salary || teacher.base_salary || 0).toLocaleString()}
Disbursement Date: ${payroll?.disbursed_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}

Please find attached your official electronic pay slip receipt for your personal financial records.

Warm Regards,
Abdul Rehman Jamil
Principal, Unique School System`;
    const fromEmail = process.env.SMTP_FROM_EMAIL || "uschools.pk@gmail.com";
    const fromName = process.env.SMTP_FROM_NAME || "Unique School System";
    const branding = mergeSiteBranding(siteBranding, await loadSiteBranding());
    const htmlContent = buildBrandedEmailHtml({
      headerTitle: "Salary Disbursement Slip",
      body: bodyText,
      footer: branding.footer_subtitle,
      branding,
      isPlainTextBody: true
    });
    const salaryAttachments = [];
    if (pdfBase64) {
      salaryAttachments.push({
        filename: `${teacher.teacher_id}_Salary_Slip_${monthYear.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        content: pdfBase64.split(",")[1] || pdfBase64,
        encoding: "base64"
      });
    }
    const salarySend = await sendTransactionalEmail({
      to: recipientEmail,
      subject,
      text: bodyText,
      html: htmlContent,
      attachments: salaryAttachments.length ? salaryAttachments : void 0
    });
    const mailStatus = salarySend.status === "Success" ? "Success" : salarySend.status;
    const logEntry = {
      id: "sal-log-" + Date.now(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      recipient_email: recipientEmail,
      recipient_type: "Faculty",
      recipient_name: recipientName,
      student_name: teacher.full_name,
      subject,
      term_name: monthYear,
      status: mailStatus,
      attachment_name: `${teacher.teacher_id}_Salary_Slip.pdf`
    };
    await persistEmailLog(logEntry);
    res.json({
      success: true,
      status: mailStatus,
      recipientEmail,
      recipientName,
      message: mailStatus === "Success" ? `Salary slip successfully emailed to ${recipientEmail}` : `Salary slip receipt dispatched to ${recipientEmail}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/email/dispatch-teacher-profile", async (req, res) => {
  try {
    const { teacher, targetEmail, pdfBase64, customNote, siteBranding } = req.body;
    if (!teacher) {
      return res.status(400).json({ error: "Teacher record required." });
    }
    const recipientEmail = targetEmail || teacher.email || "teacher@example.com";
    const recipientName = teacher.full_name;
    const subject = `Official Faculty Dossier & Profile Package - ${teacher.full_name} (${teacher.teacher_id})`;
    const docCount = collectProfileDocumentSources(teacher, "teacher").length;
    const bodyText = `Respected ${recipientName},
Assalam o Alaikum

Please find attached your official Faculty Dossier and Verified Profile Package from Unique School System.

Employee ID: ${teacher.teacher_id}
Designation: ${teacher.designation}
Assigned Classes: ${teacher.classes_assigned || "N/A"}
Assigned Subjects: ${teacher.subjects_assigned || "N/A"}
Joining Date: ${teacher.joining_date}
Contact Phone: ${teacher.phone}

${customNote ? `Additional Administrator Notes:
"${customNote}"

` : ""}Included Attachments:
1. Complete Faculty Profile Summary PDF (${teacher.teacher_id}_Profile.pdf)${docCount > 0 ? `
2. Document Gallery \u2014 ${docCount} file(s) (CNIC, degrees, certificates, and gallery uploads)` : ""}

For any queries regarding your official employment records, please contact the Principal's Secretariat.

Warm Regards,
Abdul Rehman Jamil
Principal, Unique School System`;
    const fromEmail = process.env.SMTP_FROM_EMAIL || "uschools.pk@gmail.com";
    const fromName = process.env.SMTP_FROM_NAME || "Unique School System";
    const branding = mergeSiteBranding(siteBranding, await loadSiteBranding());
    const htmlContent = buildBrandedEmailHtml({
      headerTitle: "Faculty Profile Dossier",
      body: bodyText,
      footer: branding.footer_subtitle,
      branding,
      isPlainTextBody: true
    });
    const profileAttachments = [];
    if (pdfBase64) {
      profileAttachments.push({
        filename: `${teacher.teacher_id}_Faculty_Profile.pdf`,
        content: pdfBase64.split(",")[1] || pdfBase64,
        encoding: "base64"
      });
    }
    const galleryAttachments = await buildProfileDocumentGalleryAttachments(
      teacher,
      "teacher",
      teacher.teacher_id || teacher.id || "Teacher"
    );
    profileAttachments.push(...galleryAttachments);
    const profileSend = await sendTransactionalEmail({
      to: recipientEmail,
      subject,
      text: bodyText,
      html: htmlContent,
      attachments: profileAttachments.length ? profileAttachments : void 0
    });
    const mailStatus = profileSend.status === "Success" ? "Success" : profileSend.status;
    const logEntry = {
      id: "prof-log-" + Date.now(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      recipient_email: recipientEmail,
      recipient_type: "Faculty",
      recipient_name: recipientName,
      student_name: teacher.full_name,
      subject,
      term_name: "Profile Dossier",
      status: mailStatus,
      attachment_name: `${teacher.teacher_id}_Faculty_Profile.pdf`
    };
    await persistEmailLog(logEntry);
    res.json({
      success: true,
      status: mailStatus,
      recipientEmail,
      recipientName,
      attachmentsCount: profileAttachments.length,
      message: mailStatus === "Success" ? `Faculty profile package successfully dispatched to ${recipientEmail}` : `Simulated dispatch: Teacher profile dossier sent to ${recipientEmail}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/email/fee-reminders", async (req, res) => {
  try {
    const { defaulters } = req.body;
    if (!Array.isArray(defaulters)) {
      return res.status(400).json({ error: "Defaulters array required." });
    }
    const branding = mergeSiteBranding(void 0, await loadSiteBranding());
    let dispatchedCount = 0;
    const logs = [];
    for (const d of defaulters) {
      const recipientEmail = d.is_orphan ? d.donor_email || d.guardian_email : d.guardian_email;
      const recipientName = d.is_orphan ? d.donor_name || "Donor" : d.guardian_name;
      const amountDue = Number(d.net_fee || 0) - Number(d.paid_amount || 0);
      const subject = `Fee Payment Reminder - ${d.student_name} (${d.month} ${d.year})`;
      const bodyText = `Respected ${recipientName || "Parent/Donor"},
Assalam o Alaikum

This is a fee payment reminder for ${d.student_name} for ${d.month} ${d.year}.
Outstanding amount: PKR ${amountDue.toLocaleString()}

Warm Regards,
Unique School System`;
      const htmlContent = buildBrandedEmailHtml({
        headerTitle: "Fee Payment Reminder",
        body: bodyText,
        footer: branding.footer_subtitle,
        branding,
        isPlainTextBody: true
      });
      const sendResult = recipientEmail ? await sendTransactionalEmail({
        to: recipientEmail,
        subject,
        text: bodyText,
        html: htmlContent
      }) : { status: "Failed", error: "No recipient email" };
      const log = {
        id: "fee-rem-" + Date.now() + Math.random().toString(36).slice(2, 6),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        recipient_email: recipientEmail,
        recipient_type: d.is_orphan ? "Donor" : "Guardian",
        recipient_name: recipientName,
        student_name: d.student_name,
        subject,
        term_name: `${d.month} ${d.year}`,
        status: sendResult.status === "Success" ? "Success" : sendResult.status
      };
      logs.push(log);
      if (sendResult.status === "Success") dispatchedCount++;
    }
    for (const log of logs) {
      await persistEmailLog(log);
    }
    res.json({
      success: dispatchedCount > 0 || logs.length === 0,
      dispatchedCount,
      logs,
      message: `Dispatched ${dispatchedCount} of ${defaulters.length} fee reminder email(s) via Brevo.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/supabase/file", async (req, res) => {
  try {
    const storagePath = typeof req.query.path === "string" ? req.query.path : "";
    const bucketName = typeof req.query.bucket === "string" ? req.query.bucket : "student-results";
    if (!storagePath) {
      return res.status(400).json({ error: "Invalid storage path." });
    }
    if (bucketName === CLOUDINARY_BUCKET) {
      const directUrl = typeof req.query.url === "string" ? req.query.url : "";
      if (isRemoteDocumentUrl(directUrl)) {
        return res.redirect(directUrl);
      }
      const resourceType = storagePath.toLowerCase().includes(".pdf") ? "raw" : "image";
      const deliveryUrl = buildCloudinaryDeliveryUrl(storagePath, resourceType);
      if (deliveryUrl) return res.redirect(deliveryUrl);
      return res.status(404).json({ error: "Cloudinary document not found." });
    }
    if (!storagePath.includes("/")) {
      return res.status(400).json({ error: "Invalid storage path." });
    }
    const db = await getMongoDb();
    if (bucketName === ENTITY_DOCS_BUCKET) {
      const dbDoc = await loadEntityDocumentFromDatabase(db, bucketName, storagePath);
      if (dbDoc.ok && dbDoc.buffer) {
        const fileName = import_path.default.basename(storagePath);
        res.setHeader("Content-Type", dbDoc.contentType || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        return res.send(dbDoc.buffer);
      }
    }
    const download = await downloadStorageWithFailover(bucketName, storagePath);
    if (download.ok && download.buffer) {
      const fileName = import_path.default.basename(storagePath);
      res.setHeader("Content-Type", download.contentType || "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.send(download.buffer);
    }
    const fallback = await loadEntityDocumentFromDatabase(db, bucketName, storagePath);
    if (fallback.ok && fallback.buffer) {
      const fileName = import_path.default.basename(storagePath);
      res.setHeader("Content-Type", fallback.contentType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.send(fallback.buffer);
    }
    return res.status(404).json({
      error: "File not found in database or storage. Re-upload the document if this record is old."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/supabase/upload", async (req, res) => {
  try {
    const { bucket, path: storagePath, fileBase64 } = req.body;
    if (!storagePath || !storagePath.includes("/")) {
      return res.status(400).json({ error: "Invalid storage path format." });
    }
    if (!fileBase64) {
      return res.status(400).json({ error: "fileBase64 payload is required." });
    }
    const bucketName = bucket || "student-results";
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    const storageExt = inferDocumentExt(
      fileBase64.startsWith("data:") ? fileBase64 : `data:application/octet-stream;base64,${cleanBase64.slice(0, 32)}`,
      storagePath
    );
    const contentType = contentTypeFromExt(storageExt);
    console.log(`[Document Upload] bucket '${bucketName}' path '${storagePath}' ext='${storageExt}' content-type='${contentType}'`);
    if (bucketName === ENTITY_DOCS_BUCKET) {
      if (isCloudinaryConfigured()) {
        const cloud = await uploadBufferToCloudinary(buffer, storagePath, contentType);
        if (cloud.ok && cloud.secureUrl && cloud.publicId) {
          return res.json({
            success: true,
            bucket: CLOUDINARY_BUCKET,
            path: cloud.publicId,
            publicUrl: cloud.secureUrl,
            uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
            storagePersisted: true,
            cloudPersisted: true,
            dbPersisted: false,
            message: "Document saved to Cloudinary."
          });
        }
        console.warn("[Cloudinary] Upload note:", cloud.error);
      }
      const db = await getMongoDb();
      const saved = await persistEntityDocumentToDatabase(db, bucketName, storagePath, buffer, contentType);
      if (!saved.ok) {
        return res.status(500).json({
          error: "Failed to save document. Configure Cloudinary or MongoDB/Supabase blob storage."
        });
      }
      return res.json({
        success: true,
        bucket: bucketName,
        path: storagePath,
        publicUrl: buildEntityDocProxyUrl(storagePath, bucketName),
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
        storagePersisted: true,
        dbPersisted: true,
        savedLocally: saved.mongo,
        savedToSupabase: saved.supabase,
        message: "Document saved to database fallback."
      });
    }
    const uploadResult = await uploadStorageWithFailover(bucketName, storagePath, buffer, contentType);
    if (!uploadResult.ok) {
      console.warn("[Supabase Storage] Upload note:", uploadResult.error);
      const db = await getMongoDb();
      const saved = await persistEntityDocumentToDatabase(db, bucketName, storagePath, buffer, contentType);
      return res.json({
        success: true,
        bucket: bucketName,
        path: storagePath,
        publicUrl: saved.ok ? buildEntityDocProxyUrl(storagePath, bucketName) : fileBase64.startsWith("data:") ? fileBase64 : `data:${contentType};base64,${cleanBase64}`,
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
        storagePersisted: saved.ok,
        dbPersisted: saved.ok,
        savedLocally: saved.mongo,
        savedToSupabase: saved.supabase,
        failover: getSupabaseFailoverStatus(),
        message: saved.ok ? `Document saved to database; Supabase Storage unavailable: ${uploadResult.error}` : `Supabase Storage unavailable: ${uploadResult.error}`
      });
    }
    const { data: urlData } = uploadResult.publicUrlClient.storage.from(bucketName).getPublicUrl(storagePath);
    res.json({
      success: true,
      bucket: bucketName,
      path: storagePath,
      publicUrl: urlData.publicUrl,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
      storagePersisted: true,
      message: `Document successfully uploaded to Supabase Storage at "${storagePath}"`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/email/logs", (req, res) => {
  res.json({ logs: emailLogs });
});
app.get("/api/email/health", async (_req, res) => {
  try {
    const status = await verifyEmailConnectivity();
    res.json({ success: status.ok, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/groq/chat", async (req, res) => {
  try {
    const { message, history, prompt, context } = req.body;
    const userMessage = String(message || prompt || "").trim();
    if (!userMessage) {
      return res.status(400).json({ error: "Message is required." });
    }
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.json({
        reply: "Unique School System Assistant is not configured. Add GROQ_API_KEY to your server environment (.env)."
      });
    }
    const groqMessages = [
      { role: "system", content: GROQ_SYSTEM_INSTRUCTION }
    ];
    if (context && typeof context === "object") {
      groqMessages.push({
        role: "system",
        content: `Live system context (use if relevant): ${JSON.stringify(context).slice(0, 6e3)}`
      });
    }
    if (Array.isArray(history)) {
      for (const turn of history.slice(-12)) {
        const text = turn?.parts?.[0]?.text ?? turn?.text ?? "";
        if (!text || typeof text !== "string") continue;
        const role = turn.role === "model" || turn.role === "assistant" ? "assistant" : "user";
        groqMessages.push({ role, content: text });
      }
    }
    groqMessages.push({ role: "user", content: userMessage });
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: groqMessages,
        temperature: 0.4,
        max_tokens: 1200
      })
    });
    const groqRaw = await groqRes.text();
    let groqJson = {};
    if (groqRaw.trim()) {
      try {
        groqJson = JSON.parse(groqRaw);
      } catch {
        throw new Error(`Groq returned invalid response (HTTP ${groqRes.status}). Check GROQ_API_KEY.`);
      }
    }
    if (!groqRes.ok) {
      throw new Error(groqJson?.error?.message || `Groq API error (HTTP ${groqRes.status})`);
    }
    const reply = groqJson.choices?.[0]?.message?.content?.trim() || "I could not generate a response. Please try again.";
    res.json({ reply, text: reply });
  } catch (err) {
    console.error("Groq API server route error:", err);
    res.status(500).json({ error: err.message || "Groq API call failed." });
  }
});
app.post("/api/expense/scan-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Receipt image base64 data is required." });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    if (apiKey) {
      try {
        const ai = new import_genai.GoogleGenAI({
          apiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } }
        });
        const imagePart = {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || "image/png"
          }
        };
        const promptPart = {
          text: `You are an intelligent document & expense scanner for a school system.
Examine this receipt/bill image carefully and extract key payment details.
Respond strictly in JSON format with the following keys:
{
  "amount": number, // total monetary value (e.g. 12500)
  "date": "YYYY-MM-DD", // date on receipt or today's date if missing
  "category": string, // One of: "Utilities & Power", "IT Infrastructure", "Campus Maintenance", "Salaries & Wages", "Stationery & Printing", "Events & Celebrations", "Transport & Fuel", "Lab & Sports Equipment", "Miscellaneous"
  "description": string, // vendor name and summary of goods/services
  "payment_mode": string // "Cash", "Bank Transfer", "Cheque", "Online / POS", "Corporate Card"
}`
        };
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: { parts: [imagePart, promptPart] },
          config: {
            responseMimeType: "application/json"
          }
        });
        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          return res.json({
            success: true,
            source: "Gemini AI Vision",
            data: {
              amount: Number(parsed.amount) || 0,
              date: parsed.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
              category: parsed.category || "Miscellaneous",
              description: parsed.description || "Scanned Receipt Expense",
              payment_mode: parsed.payment_mode || "Cash"
            }
          });
        }
      } catch (genErr) {
        console.warn("Gemini vision scan note:", genErr);
      }
    }
    res.json({
      success: true,
      source: "Intelligent Vision Engine (Simulated)",
      data: {
        amount: Math.floor(Math.random() * 8e3) + 1500,
        date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        category: "Utilities & Power",
        description: "Scanned Campus Utility / Vendor Receipt Voucher",
        payment_mode: "Cash"
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to scan receipt." });
  }
});
async function startServer() {
  registerEntityDocumentDbResolver(getMongoDb);
  registerSupabaseEntityBlobOps({
    upsert: async (row) => {
      const result = await upsertTableWithFailover("entity_document_blobs", [row], "id");
      return result.ok;
    },
    load: async (id) => {
      try {
        const { data } = await supabasePrimary.from("entity_document_blobs").select("content_base64, content_type").eq("id", id).maybeSingle();
        if (data) return data;
      } catch {
      }
      try {
        const { data } = await supabaseOverflow.from("entity_document_blobs").select("content_base64, content_type").eq("id", id).maybeSingle();
        return data || null;
      } catch {
        return null;
      }
    }
  });
  registerAppStoreEntityBlobOps({
    upsert: async (row) => {
      const result = await upsertAppStoreKeyWithFailover(`entity_doc:${row.id}`, {
        content_base64: row.content_base64,
        content_type: row.content_type,
        bucket: row.bucket,
        storage_path: row.storage_path,
        updated_at: row.updated_at
      });
      return result.ok;
    },
    load: async (id) => {
      const value = await selectAppStoreValue(`entity_doc:${id}`);
      if (value && typeof value === "object") {
        return value;
      }
      return null;
    }
  });
  getMongoDb().catch(() => void 0);
  if (isCloudinaryConfigured()) {
    console.log("[Cloudinary] Document storage enabled for PDFs and images.");
  } else {
    console.warn("[Cloudinary] Not configured \u2014 entity documents use database fallback.");
  }
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Unique School System Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
