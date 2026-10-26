import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import logoArea from "./assets/logo-area-clean.png";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const PLANOS_BUCKET = "planos-expedientes";
const PLANOS_TABLE = "expediente_planos";
const CERTIFICADOS_TABLE = "certificados_residencia";
const CERTIFICADOS_ARCHIVOS_TABLE = "certificado_residencia_archivos";
const CERTIFICADOS_BUCKET = PLANOS_BUCKET;
const MAX_PLANO_FILE_SIZE_MB = 50;
const ALLOWED_PLANO_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/jpg", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"];
const ALLOWED_PLANO_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx", "xls", "xlsx", "csv"];

const C = {
  bg: "#f5f7fa",
  card: "#ffffff",
  border: "#e2e8f0",
  text: "#1e293b",
  muted: "#64748b",
  dim: "#94a3b8",
  sky: "#0ea5e9",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  indigo: "#4f46e5",
  slate: "#0f172a",
  softBg: "#eef2f7",
};

const ESTADOS = {
  revision_inicial: { label: "Revisión inicial", bg: "#ede9fe", color: "#5b21b6", border: "#c4b5fd" },
  pendiente_documentacion: { label: "Pend. documentación", bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  en_proceso: { label: "En proceso", bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
  revision_legal: { label: "Revisión legal", bg: "#e0e7ff", color: "#3730a3", border: "#c7d2fe" },
  pendiente: { label: "Pendiente", bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" },
  detenido: { label: "Detenido", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  listo: { label: "Listo", bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
};

const PRIORIDADES = {
  critica: { label: "Crítica", dot: "#ef4444" },
  alta: { label: "Alta", dot: "#f97316" },
  media: { label: "Media", dot: "#f59e0b" },
  baja: { label: "Baja", dot: "#94a3b8" },
};

const AREAS = ["", "Catastro", "Obras", "Legales", "Escribanía", "Topografía", "Dirección", "Mesa de Entradas"];
const UBICACIONES = ["", "Área técnica BRS", "Catastro"];

function isSupabasePaused(error) {
  if (!error) return false;
  const msg = (error.message || error.toString() || "").toLowerCase();
  return (
    msg.includes("project is paused") ||
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    (error.code === "PGRST301") ||
    (error.status === 503) ||
    msg.includes("503")
  );
}
const LOCALIDADES = ["Banda del Río Salí", "Lastenia"];
const ESTADOS_CIVILES = ["", "Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Unión convivencial", "Otro"];

const ALL_BARRIOS = [
  "Barrio 140 Viviendas",
  "Barrio 19 de Octubre",
  "Barrio 200 Viviendas",
  "Barrio 4 de Junio",
  "Barrio 40 Viviendas",
  "Barrio 60 Viviendas",
  "Barrio 63 Viviendas",
  "Barrio Aeropuerto",
  "Barrio Alberdi",
  "Barrio Albornoz",
  "Barrio Alto Nuestra Señora del Valle",
  "Barrio Ampliación 4 de Junio",
  "Barrio Ampliación La Milagrosa",
  "Barrio Belgrano 2",
  "Barrio Capitán Candelaria",
  "Barrio Cifre",
  "Barrio Cruz del Norte",
  "Barrio El Cuadro",
  "Barrio El Mirador",
  "Barrio El Polígono",
  "Barrio El Sol",
  "Barrio Enriquetta de Orell",
  "Barrio Fadel",
  "Barrio Fassora",
  "Barrio Fatima",
  "Barrio Flor y Perfume",
  "Barrio General Belgrano",
  "Barrio Juan Posse",
  "Barrio Kilometro 11",
  "Barrio La Arboleda",
  "Barrio La Cerámica",
  "Barrio La Costanera",
  "Barrio La Milagrosa",
  "Barrio La Rivera",
  "Barrio Las Palmeras",
  "Barrio Los Fresnos",
  "Barrio Los Pinos",
  "Barrio Lotear",
  "Barrio Manzana de Oro",
  "Barrio Nuestra Señora del Valle",
  "Barrio Pacará",
  "Barrio Pacará Pintado",
  "Barrio Pozo del Alto",
  "Barrio Presidente Menem",
  "Barrio Presidente Perón",
  "Barrio Progreso",
  "Barrio Refusta",
  "Barrio Sagrado Corazón de Jesús",
  "Barrio San Antonio del Alto",
  "Barrio San Antonio del Bajo",
  "Barrio San Jorge",
  "Barrio San José",
  "Barrio San Juan",
  "Barrio San Justo",
  "Barrio San Miguel Arcangel (260 viv)",
  "Barrio San Ramón 1",
  "Barrio San Ramón 2",
  "Barrio Santa Clara",
  "Barrio Santa Rita",
  "Barrio Santa Rita 1",
  "Barrio Santa Rosa",
  "Barrio Santo Cristo 1",
  "Barrio Santo Cristo 2",
  "Barrio Sargento Cabral",
  "Barrio SMATA (150 Viviendas)",
  "Barrio Soldado Tucumano",
  "Barrio Unión y Progreso",
  "Barrio Victoriano Caro",
  "Barrio Villa Cariño",
  "Barrio Villa Inés",
  "Barrio Villa Lastenia",
  "Otro",
];

const BARRIOS = {
  "Banda del Río Salí": ALL_BARRIOS,
  Lastenia: ALL_BARRIOS,
};

const LOGIN_USERS = [
  { id: "gonzalo-monteros", nombre: "Gonzalo Monteros", rol: "Intendente", area: "Intendencia", tecnico: false, canEdit: false, requiresPassword: false, canAddExecutiveNotes: true },
  { id: "estela-palacios", nombre: "Estela Palacios", rol: "Directora", area: "Dirección", tecnico: false, canEdit: true, requiresPassword: true, canAddExecutiveNotes: false },
  { id: "carlos-chauvet", nombre: "Carlos Chauvet", rol: "Área técnica", area: "Técnica", tecnico: true, canEdit: true, requiresPassword: true, canAddExecutiveNotes: false },
  { id: "emmanuel-aguilar", nombre: "Emmanuel Aguilar", rol: "Agente de campo", area: "Agente de campo", tecnico: true, canEdit: true, requiresPassword: true, canAddExecutiveNotes: false },
  { id: "andres-ferrer", nombre: "Andrés Ferrer", rol: "Área técnica", area: "Técnica", tecnico: true, canEdit: true, requiresPassword: true, canAddExecutiveNotes: false },
  { id: "usuario", nombre: "Usuario", rol: "Solo lectura", area: "Consulta", tecnico: false, canEdit: false, requiresPassword: false, canAddExecutiveNotes: false },
];

const MIN_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 14;
const ACCESS_HISTORY_KEY = "cig_panel_access_history_v1";


const TABLE_COLGROUP = [
  { key: "check", width: "36px" },
  { key: "expediente", width: "118px" },
  { key: "titular", width: "220px" },
  { key: "dni", width: "100px" },
  { key: "contacto", width: "118px" },
  { key: "estadoCivil", width: "120px" },
  { key: "barrio", width: "190px" },
  { key: "padron", width: "98px" },
  { key: "archivos", width: "145px" },
  { key: "estado", width: "112px" },
  { key: "area", width: "110px" },
  { key: "responsable", width: "126px" },
  { key: "notas", width: "210px" },
  { key: "acciones", width: "98px" },
];

const EXPEDIENTES_TABLE_HEADERS = [
  "✓",
  "N° Expediente",
  "Titular",
  "DNI",
  "Contacto",
  "Estado civil",
  "Barrio",
  "N° de padrón",
  "Archivos",
  "Estado",
  "Área",
  "Ubicación",
  "Notas",
  "Acciones",
];


const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 8px",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 13,
  background: "#f8fafc",
  color: C.text,
  outline: "none",
};

const compactInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "5px 8px",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 11,
  background: "#fff",
  color: C.text,
  outline: "none",
  minHeight: 30,
  lineHeight: 1.2,
};

const btnPrimary = {
  background: C.sky,
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const btnGhost = {
  background: "#fff",
  color: C.muted,
  border: `1px solid ${C.border}`,
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const buttonHoverHandlers = {
  onMouseEnter: (e) => {
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 8px 18px rgba(15, 23, 42, .14)";
    e.currentTarget.style.filter = "brightness(1.03)";
  },
  onMouseLeave: (e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.filter = "none";
  },
};

const interactiveButtonStyle = {
  transition: "transform .15s ease, box-shadow .15s ease, filter .15s ease, background .15s ease",
};

const labelStyle = {
  fontSize: 10,
  color: C.dim,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: ".05em",
  marginBottom: 3,
};

function EmptyBlock({ title, text, action = null }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{title}</div>
      <div style={{ fontSize: 13, marginTop: 8 }}>{text}</div>
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildUsersMap(users) {
  return users.reduce((acc, user) => {
    acc[user.id] = user.nombre;
    return acc;
  }, {});
}

function nextExpedienteNumber(items) {
  const currentYear = new Date().getFullYear();
  const maxCorrelative = items.reduce((max, item) => {
    const match = String(item.num || "").match(/EXP-\d{4}-(\d+)/i);
    if (!match) return max;
    return Math.max(max, Number(match[1] || 0));
  }, 0);
  return `EXP-${currentYear}-${String(maxCorrelative + 1).padStart(3, "0")}`;
}

function nextExpedienteNumberFromSeed(seed, index) {
  const currentYear = new Date().getFullYear();
  return `EXP-${currentYear}-${String(seed + index).padStart(3, "0")}`;
}

function composeBarrio(localidad, barrio) {
  return `${localidad} | ${barrio}`;
}

function splitBarrio(value) {
  if (!value || !String(value).includes(" | ")) {
    return { localidad: "", barrio: value || "" };
  }
  const [localidad, barrio] = String(value).split(" | ");
  return { localidad: localidad || "", barrio: barrio || "" };
}

function cleanText(value) {
  return String(value || "").trim();
}

async function hashPassword(value) {
  const raw = cleanText(value);
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const PASSWORD_HASH_CACHE_KEY = "cig_panel_password_hash_cache_v1";

function readPasswordHashCache() {
  try {
    const raw = localStorage.getItem(PASSWORD_HASH_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePasswordHashCache(usuarioClave, passwordHash) {
  try {
    if (!usuarioClave || !passwordHash) return;
    const current = readPasswordHashCache();
    localStorage.setItem(PASSWORD_HASH_CACHE_KEY, JSON.stringify({ ...current, [usuarioClave]: passwordHash }));
  } catch {
    // respaldo local no disponible
  }
}

function getLoginClaveById(userId) {
  if (userId === "gonzalo-monteros") return "gonzalo";
  if (userId === "estela-palacios") return "estela";
  if (userId === "carlos-chauvet") return "carlos";
  if (userId === "emmanuel-aguilar") return "emmanuel";
  if (userId === "andres-ferrer") return "andres";
  if (userId === "usuario") return "usuario";
  return "";
}

function normalizeTitular(value) {
  return cleanText(value).replace(/\s+/g, " ").toUpperCase();
}

function normalizePhone(value) {
  return cleanText(value).replace(/\s+/g, "");
}

function stripAccents(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toSearchable(value) {
  return cleanText(value).toLowerCase();
}

function truncateText(value, max = 70) {
  const text = cleanText(value);
  if (!text) return "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function getFileExtension(fileName) {
  return String(fileName || "").split(".").pop()?.toLowerCase() || "";
}

function isAllowedPlanoFile(file) {
  if (!file) return false;
  const extension = getFileExtension(file.name);
  return ALLOWED_PLANO_MIME_TYPES.includes(file.type) || ALLOWED_PLANO_EXTENSIONS.includes(extension);
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "—";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function isPreviewableFile(fileName = "", mimeType = "") {
  const extension = getFileExtension(fileName);
  return ["pdf", "jpg", "jpeg", "png", "webp"].includes(extension) || String(mimeType || "").startsWith("image/") || mimeType === "application/pdf";
}

function getPreviewType(fileName = "", mimeType = "") {
  const extension = getFileExtension(fileName);
  if (["jpg", "jpeg", "png", "webp"].includes(extension) || String(mimeType || "").startsWith("image/")) return "image";
  if (extension === "pdf" || mimeType === "application/pdf") return "pdf";
  return "other";
}

function buildBarrioFilterOptions() {
  return LOCALIDADES.map((localidad) => ({
    localidad,
    items: (BARRIOS[localidad] || []).map((barrio) => ({
      value: composeBarrio(localidad, barrio),
      label: barrio,
    })),
  }));
}

function getAttachmentLabel(fileName = "", mimeType = "") {
  const ext = getFileExtension(fileName);
  if (["jpg", "jpeg", "png", "webp"].includes(ext) || String(mimeType).startsWith("image/")) return "Imagen";
  if (ext === "pdf" || mimeType === "application/pdf") return "PDF";
  if (["doc", "docx"].includes(ext)) return "Documento";
  if (["xls", "xlsx", "csv"].includes(ext)) return "Planilla";
  return "Archivo";
}

function isPreviewableAttachment(fileName = "", mimeType = "") {
  const ext = getFileExtension(fileName);
  return mimeType === "application/pdf" || String(mimeType).startsWith("image/") || ["pdf", "jpg", "jpeg", "png", "webp"].includes(ext);
}

function getExpedienteCompleteness(expediente, attachments = []) {
  const scoreMap = [
    { ok: cleanText(expediente?.num), weight: 1 },
    { ok: cleanText(expediente?.titular), weight: 1 },
    { ok: cleanText(expediente?.dni), weight: 1 },
    { ok: cleanText(expediente?.telefono), weight: 1 },
    { ok: cleanText(expediente?.barrio), weight: 1 },
    { ok: cleanText(expediente?.estadoCivil), weight: 1 },
    { ok: cleanText(expediente?.padronNumero), weight: 1 },
    { ok: cleanText(expediente?.estado), weight: 1 },
    { ok: cleanText(expediente?.area), weight: 1 },
    { ok: cleanText(expediente?.resp), weight: 1 },
    { ok: cleanText(expediente?.notas) || cleanText(expediente?.observaciones), weight: 1 },
    { ok: attachments.length > 0, weight: 2 },
  ];

  const completed = scoreMap.reduce((acc, item) => acc + (item.ok ? item.weight : 0), 0);
  const total = scoreMap.reduce((acc, item) => acc + item.weight, 0);
  const percent = Math.round((completed / total) * 100);

  let level = "bajo";
  let label = "Bajo";
  if (percent >= 75) {
    level = "alto";
    label = "Alto";
  } else if (percent >= 45) {
    level = "medio";
    label = "Intermedio";
  }

  return { completed, total, percent, level, label };
}

function getExpedienteWarnings(expediente, attachments = []) {
  const warnings = [];
  if (expediente?.estado === "listo" && attachments.length === 0) warnings.push("Está marcado como listo, pero no tiene archivos adjuntos.");
  if (cleanText(expediente?.dni) && !cleanText(expediente?.titular)) warnings.push("Tiene DNI cargado, pero falta el nombre del titular.");
  if (cleanText(expediente?.padronNumero) && !cleanText(expediente?.barrio)) warnings.push("Tiene padrón cargado, pero falta barrio o localidad.");
  if (["en_proceso", "revision_legal", "listo"].includes(expediente?.estado) && !cleanText(expediente?.resp)) warnings.push("El estado actual sugiere indicar la ubicación del expediente.");
  if (expediente?.estado === "revision_legal" && !cleanText(expediente?.padronNumero)) warnings.push("Revisión legal sin padrón cargado.");
  return warnings;
}

function getEstadoSelectStyle(estado) {
  const current = ESTADOS[estado] || ESTADOS.pendiente;
  return {
    ...compactInputStyle,
    background: current.bg,
    color: current.color,
    borderColor: current.border,
    fontWeight: 700,
  };
}

function CompletenessBadge({ expediente, attachments = [] }) {
  const info = getExpedienteCompleteness(expediente, attachments);
  const styles = info.level === "alto"
    ? { background: "#dcfce7", color: "#166534", border: "#bbf7d0" }
    : info.level === "medio"
    ? { background: "#fef3c7", color: "#92400e", border: "#fde68a" }
    : { background: "#e2e8f0", color: "#475569", border: "#cbd5e1" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 9px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        background: styles.background,
        color: styles.color,
        border: `1px solid ${styles.border}`,
      }}
    >
      {info.label} · {info.percent}%
    </span>
  );
}

function buildPlanoPublicUrl(filePath) {
  if (!supabase || !filePath) return "";
  const { data } = supabase.storage.from(PLANOS_BUCKET).getPublicUrl(filePath);
  return data?.publicUrl || "";
}

function normalizePlanoRecord(row) {
  if (!row) return null;
  const path = row.archivo_path || row.path || row.plano_path || "";
  return {
    id: row.id,
    expedienteId: row.expediente_id,
    archivoPath: path,
    nombreOriginal: row.nombre_original || row.nombre || path.split("/").pop() || "Archivo",
    tipoMime: row.tipo_mime || "",
    tamanoBytes: Number(row.tamano_bytes || 0),
    createdAt: row.created_at || null,
    uploadedBy: row.uploaded_by || null,
    publicUrl: row.public_url || buildPlanoPublicUrl(path),
  };
}


function normalizeCertificadoRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    numero: row.numero || "",
    vecinoNombre: row.vecino_nombre || "",
    dni: row.dni || "",
    domicilio: row.domicilio || "",
    barrio: row.barrio || "",
    padronCatastral: row.padron_catastral || "",
    matriculaCatastral: row.matricula_catastral || "",
    propietarioLegal: row.propietario_legal || "",
    telefono: row.telefono || "",
    motivo: row.motivo || "",
    presentadoAnte: row.presentado_ante || "",
    estado: row.estado || "pendiente",
    fechaVisita: row.fecha_visita || "",
    observaciones: row.observaciones || "",
    agenteNombre: row.agente_nombre || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeCertificadoArchivoRecord(row) {
  if (!row) return null;
  const path = row.archivo_path || "";
  return {
    id: row.id,
    certificadoId: row.certificado_id,
    archivoPath: path,
    nombreOriginal: row.nombre_original || path.split("/").pop() || "Archivo",
    tipoMime: row.tipo_mime || "",
    tamanoBytes: Number(row.tamano_bytes || 0),
    createdAt: row.created_at || null,
    uploadedBy: row.uploaded_by || null,
    publicUrl: row.public_url || buildStoragePublicUrl(CERTIFICADOS_BUCKET, path),
  };
}

function buildCertificadosArchivosIndex(rows) {
  const index = {};
  for (const row of rows || []) {
    const normalized = normalizeCertificadoArchivoRecord(row);
    if (!normalized?.certificadoId) continue;
    if (!index[normalized.certificadoId]) index[normalized.certificadoId] = [];
    index[normalized.certificadoId].push(normalized);
  }
  Object.keys(index).forEach((certificadoId) => {
    index[certificadoId].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  });
  return index;
}

function buildStoragePublicUrl(bucket, filePath) {
  if (!supabase || !filePath) return "";
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data?.publicUrl || "";
}

function nextCertificadoNumber(rows = []) {
  const currentYear = new Date().getFullYear();
  const prefix = `CR-${currentYear}-`;
  const max = rows.reduce((acc, row) => {
    const numero = cleanText(row.numero);
    if (!numero.startsWith(prefix)) return acc;
    const n = Number(numero.replace(prefix, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function buildPlanosIndex(rows) {
  const index = {};
  for (const row of rows || []) {
    const normalized = normalizePlanoRecord(row);
    if (!normalized?.expedienteId) continue;
    if (!index[normalized.expedienteId]) index[normalized.expedienteId] = [];
    index[normalized.expedienteId].push(normalized);
  }

  Object.keys(index).forEach((key) => {
    index[key].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  });

  return index;
}

function normalizeObservacionIntendente(row) {
  if (!row) return null;
  return {
    id: row.id,
    expedienteId: row.expediente_id,
    autorNombre: row.autor_nombre || "Gonzalo Monteros",
    autorRol: row.autor_rol || "Intendente",
    observacion: row.observacion || "",
    createdAt: row.created_at || null,
  };
}

function buildObservacionesIndex(rows) {
  const index = {};
  for (const row of rows || []) {
    const normalized = normalizeObservacionIntendente(row);
    if (!normalized?.expedienteId) continue;
    if (!index[normalized.expedienteId]) index[normalized.expedienteId] = [];
    index[normalized.expedienteId].push(normalized);
  }

  Object.keys(index).forEach((key) => {
    index[key].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  });

  return index;
}

async function fetchObservacionesIntendenteIndex(expedienteIds = []) {
  if (!supabase || !Array.isArray(expedienteIds) || expedienteIds.length === 0) return { data: {}, error: null };

  const { data, error } = await supabase
    .from("observaciones_intendente")
    .select("id, expediente_id, autor_nombre, autor_rol, observacion, created_at")
    .in("expediente_id", expedienteIds)
    .order("created_at", { ascending: false });

  if (error) return { data: {}, error };
  return { data: buildObservacionesIndex(data || []), error: null };
}

async function fetchPlanosIndex(expedienteIds = []) {
  if (!supabase || !Array.isArray(expedienteIds) || expedienteIds.length === 0) return { data: {}, error: null };

  const { data, error } = await supabase
    .from(PLANOS_TABLE)
    .select("id, expediente_id, archivo_path, nombre_original, tipo_mime, tamano_bytes, created_at, uploaded_by")
    .in("expediente_id", expedienteIds)
    .order("created_at", { ascending: false });

  if (error) return { data: {}, error };
  return { data: buildPlanosIndex(data || []), error: null };
}

async function fetchPlanosForExpediente(expedienteId) {
  if (!supabase || !expedienteId) return { data: [], error: null };

  const { data, error } = await supabase
    .from(PLANOS_TABLE)
    .select("id, expediente_id, archivo_path, nombre_original, tipo_mime, tamano_bytes, created_at, uploaded_by")
    .eq("expediente_id", expedienteId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };
  return { data: (data || []).map(normalizePlanoRecord), error: null };
}


async function fetchCertificados() {
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from(CERTIFICADOS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };
  return { data: (data || []).map(normalizeCertificadoRecord), error: null };
}

async function fetchCertificadoArchivosIndex(certificadoIds = []) {
  if (!supabase || !Array.isArray(certificadoIds) || certificadoIds.length === 0) return { data: {}, error: null };

  const { data, error } = await supabase
    .from(CERTIFICADOS_ARCHIVOS_TABLE)
    .select("id, certificado_id, archivo_path, nombre_original, tipo_mime, tamano_bytes, created_at, uploaded_by")
    .in("certificado_id", certificadoIds)
    .order("created_at", { ascending: false });

  if (error) return { data: {}, error };
  return { data: buildCertificadosArchivosIndex(data || []), error: null };
}

function normalizeExpediente(row) {
  return {
    id: row.id,
    num: row.numero_expediente || `EXP-${row.id}`,
    titular: normalizeTitular(row.titular),
    dni: row.dni || "",
    telefono: normalizePhone(row.telefono),
    barrio: row.barrio || "",
    estadoCivil: row.estado_civil || "",
    padronNumero: row.padron_numero || "",
    planoUrl: row.plano_url || (row.plano_path ? buildPlanoPublicUrl(row.plano_path) : ""),
    planoPath: row.plano_path || "",
    estado: row.estado || "pendiente",
    area: row.area_actual || "",
    resp: row.responsable_id || "",
    doc: row.documentacion || "incompleta",
    dias: Number(row.dias_sin_avance || row.dias_sin_movimiento || 0),
    upd: row.ultima_actualizacion || row.updated_at || row.created_at || null,
    prio: row.prioridad || "baja",
    observaciones: row.observaciones || "",
    notas: row.notas || "",
    editableTecnico: row.editable_tecnico ?? true,
    origenCarga: row.origen_carga || "manual",
    createdAt: row.created_at || null,
  };
}

function buildUpdatePayload(partial) {
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(partial, "titular")) payload.titular = normalizeTitular(partial.titular);
  if (Object.prototype.hasOwnProperty.call(partial, "dni")) payload.dni = cleanText(partial.dni);
  if (Object.prototype.hasOwnProperty.call(partial, "telefono")) payload.telefono = normalizePhone(partial.telefono);
  if (Object.prototype.hasOwnProperty.call(partial, "barrio")) payload.barrio = partial.barrio;
  if (Object.prototype.hasOwnProperty.call(partial, "estadoCivil")) payload.estado_civil = cleanText(partial.estadoCivil);
  if (Object.prototype.hasOwnProperty.call(partial, "padronNumero")) payload.padron_numero = cleanText(partial.padronNumero);
  if (Object.prototype.hasOwnProperty.call(partial, "planoUrl")) payload.plano_url = cleanText(partial.planoUrl);
  if (Object.prototype.hasOwnProperty.call(partial, "planoPath")) payload.plano_path = cleanText(partial.planoPath);
  if (Object.prototype.hasOwnProperty.call(partial, "estado")) payload.estado = partial.estado;
  if (Object.prototype.hasOwnProperty.call(partial, "area")) payload.area_actual = partial.area;
  if (Object.prototype.hasOwnProperty.call(partial, "resp")) payload.responsable_id = partial.resp || null;
  if (Object.prototype.hasOwnProperty.call(partial, "doc")) payload.documentacion = partial.doc;
  if (Object.prototype.hasOwnProperty.call(partial, "prio")) payload.prioridad = partial.prio;
  if (Object.prototype.hasOwnProperty.call(partial, "notas")) payload.notas = partial.notas || "";
  if (Object.prototype.hasOwnProperty.call(partial, "observaciones")) payload.observaciones = partial.observaciones || "";
  payload.ultima_actualizacion = new Date().toISOString();
  payload.updated_at = new Date().toISOString();
  return payload;
}

function normalizeHeader(value) {
  return stripAccents(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeDni(value) {
  const raw = cleanText(value);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.length <= 8) return digits;
  return digits.slice(2, 10);
}

function normalizeComparableText(value) {
  return stripAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePadron(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9/.-]/g, "");
}

function buildDuplicateKey({ titular, padronNumero }) {
  const normalizedTitular = normalizeComparableText(titular);
  const normalizedPadron = normalizePadron(padronNumero);
  if (!normalizedTitular || !normalizedPadron) return "";
  return `${normalizedTitular}__${normalizedPadron}`;
}

function findDuplicatePadron(records = [], padronNumero, excludeId = null) {
  const target = normalizePadron(padronNumero);
  if (!target) return null;
  return (records || []).find((row) => {
    if (!row) return false;
    if (excludeId !== null && String(row.id) === String(excludeId)) return false;
    return normalizePadron(row.padronNumero ?? row.padron_numero) === target;
  }) || null;
}


function getDuplicateSignature(row) {
  const dni = normalizeDni(row?.dni);
  if (dni) return `DNI:${dni}`;
  const fallback = buildDuplicateKey({ titular: row?.titular, padronNumero: row?.padron_numero ?? row?.padronNumero });
  return fallback ? `TP:${fallback}` : "";
}

function getRowsToDeleteByDuplicateRule(rows) {
  const sorted = [...(rows || [])].sort((a, b) => {
    const aTime = new Date(a.created_at || a.updated_at || 0).getTime();
    const bTime = new Date(b.created_at || b.updated_at || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return Number(a.id || 0) - Number(b.id || 0);
  });

  const seen = new Set();
  const idsToDelete = [];

  for (const row of sorted) {
    const signature = getDuplicateSignature(row);
    if (!signature) continue;
    if (seen.has(signature)) {
      idsToDelete.push(row.id);
      continue;
    }
    seen.add(signature);
  }

  return idsToDelete;
}

function buildFrontendDuplicateSignature(row) {
  const dni = normalizeDni(row?.dni);
  if (dni) return `DNI:${dni}`;

  const titular = normalizeComparableText(row?.titular);
  const padron = normalizePadron(row?.padronNumero);
  if (titular && padron) return `TP:${titular}__${padron}`;

  const barrio = normalizeComparableText(row?.barrio);
  if (titular && barrio) return `TB:${titular}__${barrio}`;

  return `ROW:${row?.id ?? Math.random()}`;
}

function dedupeExpedientesForView(rows) {
  const seen = new Set();
  const uniqueRows = [];
  let hiddenDuplicates = 0;

  for (const row of rows || []) {
    const signature = buildFrontendDuplicateSignature(row);
    if (seen.has(signature)) {
      hiddenDuplicates += 1;
      continue;
    }
    seen.add(signature);
    uniqueRows.push(row);
  }

  return {
    uniqueRows,
    hiddenDuplicates,
    totalRows: Array.isArray(rows) ? rows.length : 0,
  };
}

function detectLocalidadFromFilename(fileName) {
  const key = normalizeHeader(fileName);
  return key.includes("lastenia") ? "Lastenia" : "Banda del Río Salí";
}

function detectBarrioFromFilename(fileName) {
  const base = stripAccents(fileName)
    .replace(/\.xlsx$|\.xls$|\.csv$/i, "")
    .replace(/[()]/g, " ")
    .replace(/\b(act|actualizado|completo|completa|nancy|mza|manzana|hoja|sheet|2024|2025|2026)\b/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalizedBase = normalizeHeader(base);

  const variants = [
    { match: ["lamilagrosa"], value: "Barrio La Milagrosa" },
    { match: ["ampliacionlamilagrosa"], value: "Barrio Ampliación La Milagrosa" },
    { match: ["costanera"], value: "Barrio La Costanera" },
    { match: ["ptemenem", "presidentemenem", "barrioptemenem"], value: "Barrio Presidente Menem" },
    { match: ["unionyprogreso", "unionyprogeso", "progreso"], value: "Barrio Unión y Progreso" },
    { match: ["villalastenia", "lastenia"], value: "Barrio Villa Lastenia" },
    { match: ["260viviendas", "260viv", "sanmiguelarcangel"], value: "Barrio San Miguel Arcangel (260 viv)" },
    { match: ["alberdi"], value: "Barrio Alberdi" },
    { match: ["sanramonii", "sanramon2"], value: "Barrio San Ramón 2" },
    { match: ["aeropuerto"], value: "Barrio Aeropuerto" },
  ];

  for (const item of variants) {
    if (item.match.some((token) => normalizedBase.includes(token))) return item.value;
  }

  const found = ALL_BARRIOS.find((barrio) => normalizedBase.includes(normalizeHeader(barrio.replace(/^Barrio\s+/i, ""))));
  return found || base || "Otro";
}

function findHeaderRow(rows) {
  let bestIndex = -1;
  let bestScore = -1;
  const keys = ["padron", "padronn", "apellidoynombre", "apellidoynombre", "nombreyapellido", "nombreyapellido", "dni", "estadocivil", "observacion", "entrega", "dominio", "respfiscal", "telefono", "celular", "contacto"];

  rows.slice(0, 15).forEach((row, index) => {
    const normalized = row.map((cell) => normalizeHeader(cell));
    const score = keys.reduce((acc, key) => acc + (normalized.some((cell) => cell.includes(key)) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore > 0 ? bestIndex : -1;
}

function findColumnIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}


async function fetchAllExpedientes() {
  if (!supabase) return { data: [], error: null };

  const pageSize = 1000;
  let from = 0;
  let allRows = [];

  while (true) {
    const { data: rows, error } = await supabase
      .from("expedientes")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) return { data: [], error };

    const batch = rows || [];
    allRows = allRows.concat(batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { data: allRows, error: null };
}

function mapSheetRowsToRecords(rows, fileName) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const headerRowIndex = findHeaderRow(rows);
  const startIndex = headerRowIndex >= 0 ? headerRowIndex : 0;
  const headers = (rows[startIndex] || []).map((cell) => normalizeHeader(cell));

  const titularIndex = findColumnIndex(headers, [
    "apellidoynombre",
    "apellidosynombres",
    "nombreyapellido",
    "nombres",
    "responsablefiscal",
    "respfiscal",
    "propietariolegal",
    "dominio",
    "titular",
  ]);
  const dniIndex = findColumnIndex(headers, ["dni", "dniycuil", "dnicuil", "nrodocumento", "documento"]);
  const telefonoIndex = findColumnIndex(headers, ["telefono", "telefonocelular", "celular", "contacto", "telefono1", "movil"]);
  const estadoCivilIndex = findColumnIndex(headers, ["estadocivil"]);
  const padronIndex = findColumnIndex(headers, ["padron", "padronn", "cuenta", "nrocuenta"]);
  const observacionIndex = findColumnIndex(headers, ["observacion", "observaciones", "entrega", "estado", "expediente", "exped", "notas"]);

  const barrio = detectBarrioFromFilename(fileName);
  const localidad = detectLocalidadFromFilename(fileName);

  return rows
    .slice(startIndex + 1)
    .map((row) => {
      const titularRaw = titularIndex >= 0 ? row[titularIndex] : "";
      const dniRaw = dniIndex >= 0 ? row[dniIndex] : "";
      const telefonoRaw = telefonoIndex >= 0 ? row[telefonoIndex] : "";
      const estadoCivilRaw = estadoCivilIndex >= 0 ? row[estadoCivilIndex] : "";
      const padronRaw = padronIndex >= 0 ? row[padronIndex] : "";
      const observacionRaw = observacionIndex >= 0 ? row[observacionIndex] : "";

      const titular = normalizeTitular(titularRaw);
      const dni = normalizeDni(dniRaw);
      const telefono = normalizePhone(telefonoRaw);
      const estadoCivil = cleanText(estadoCivilRaw);
      const padronNumero = cleanText(padronRaw);
      const observaciones = cleanText(observacionRaw);

      if (!titular && !dni && !padronNumero && !telefono) return null;
      if (titular && ["padron", "apellidoynombre", "respfiscal", "nombreyapellido", "dominio", "titular"].includes(normalizeHeader(titular))) return null;

      return {
        titular,
        dni,
        telefono,
        estadoCivil,
        localidad,
        barrio,
        padronNumero,
        observaciones,
        notas: "",
      };
    })
    .filter(Boolean);
}

async function parseExcelFiles(files) {
  const XLSX = await import("xlsx");
  const all = [];
  const details = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    let fileCount = 0;

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const records = mapSheetRowsToRecords(rows, file.name);
      fileCount += records.length;
      all.push(...records);
    });

    details.push({ fileName: file.name, count: fileCount, barrio: detectBarrioFromFilename(file.name) });
  }

  return { records: all, details };
}

function Badge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.pendiente;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 9px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 600,
        background: e.bg,
        color: e.color,
        border: `1px solid ${e.border}`,
      }}
    >
      {e.label}
    </span>
  );
}

function Priority({ prioridad }) {
  const p = PRIORIDADES[prioridad] || PRIORIDADES.baja;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.dot, display: "inline-block" }} />
      {p.label}
    </span>
  );
}

function Doc({ doc }) {
  return doc === "completa" ? (
    <span style={{ fontSize: 11, color: C.green }}>✓ Completa</span>
  ) : (
    <span style={{ fontSize: 11, color: C.red }}>! Incompleta</span>
  );
}

function IntendenteDashboard({ data }) {
  const estadosKeys = Object.keys(ESTADOS);
  const rows = useMemo(() => {
    const grouped = {};
    for (const exp of data || []) {
      const zona = splitBarrio(exp.barrio);
      const barrio = cleanText(zona.barrio) || cleanText(exp.barrio) || "Sin barrio";
      if (!grouped[barrio]) {
        grouped[barrio] = { barrio, total: 0, listos: 0, estados: Object.fromEntries(estadosKeys.map((key) => [key, 0])) };
      }
      grouped[barrio].total += 1;
      grouped[barrio].estados[exp.estado] = (grouped[barrio].estados[exp.estado] || 0) + 1;
      if (exp.estado === "listo") grouped[barrio].listos += 1;
    }

    return Object.values(grouped)
      .map((row) => ({ ...row, avance: row.total ? Math.round((row.listos / row.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total || a.barrio.localeCompare(b.barrio));
  }, [data]);

  const totalExpedientes = data.length;
  const totalListos = data.filter((exp) => exp.estado === "listo").length;
  const avanceGeneral = totalExpedientes ? Math.round((totalListos / totalExpedientes) * 100) : 0;
  const barriosConDetenidos = rows.filter((row) => row.estados.detenido > 0).length;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Expedientes</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{totalExpedientes}</div>
          <div style={{ marginTop: 8, color: C.dim, fontSize: 12 }}>Total cargado en el sistema</div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Barrios</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{rows.length}</div>
          <div style={{ marginTop: 8, color: C.dim, fontSize: 12 }}>Con expedientes registrados</div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Avance general</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{avanceGeneral}%</div>
          <div style={{ marginTop: 10, height: 9, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${avanceGeneral}%`, background: C.green }} />
          </div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Barrios con detenidos</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{barriosConDetenidos}</div>
          <div style={{ marginTop: 8, color: C.dim, fontSize: 12 }}>Requieren seguimiento ejecutivo</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.slate }}>Estado por barrio</div>
          <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>Avance calculado sobre expedientes listos respecto del total del barrio.</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1080, borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "1px solid #f1f5f9" }}>
                {["Barrio", "Total", ...estadosKeys.map((key) => ESTADOS[key].label), "Avance"].map((head) => (
                  <th key={head} style={{ padding: "9px 10px", textAlign: "left", color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={estadosKeys.length + 3} style={{ padding: 20, color: C.dim }}>No hay expedientes cargados.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.barrio} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px", fontWeight: 800, color: C.slate }}>{row.barrio}</td>
                  <td style={{ padding: "10px", fontWeight: 700 }}>{row.total}</td>
                  {estadosKeys.map((key) => (
                    <td key={key} style={{ padding: "10px", color: row.estados[key] ? C.slate : C.dim, fontWeight: row.estados[key] ? 700 : 500 }}>{row.estados[key] || 0}</td>
                  ))}
                  <td style={{ padding: "10px", minWidth: 170 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${row.avance}%`, height: "100%", background: row.avance >= 70 ? C.green : row.avance >= 35 ? C.amber : C.red }} />
                      </div>
                      <div style={{ width: 38, textAlign: "right", fontWeight: 800 }}>{row.avance}%</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ selectedUserId, onSelectUser, onIngresar, loginLoading, loginError, loginPassword, onPasswordChange, onOpenChangePassword, onOpenManualReset }) {
  const [showPassword, setShowPassword] = useState(false);
  const selectedUser = LOGIN_USERS.find((user) => user.id === selectedUserId);
  const selectedNeedsPassword = Boolean(selectedUser?.requiresPassword);

  const getUserSubtitle = (user) => {
    if (user.id === "gonzalo-monteros") return "Intendente · tablero ejecutivo";
    if (user.id === "estela-palacios") return "Directora";
    if (user.id === "carlos-chauvet") return "Responsable de área técnica";
    if (user.id === "emmanuel-aguilar") return "Agente de campo";
    if (user.id === "andres-ferrer") return "Área técnica";
    if (user.id === "usuario") return "Solo lectura";
    return "";
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "linear-gradient(180deg,#edf5fb 0%, #f5f7fa 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#fff",
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(15,23,42,.12)",
          border: `1px solid ${C.border}`,
          maxHeight: "calc(100vh - 10px)",
        }}
      >
        <div style={{ height: 6, background: "linear-gradient(90deg,#0ea5e9,#14b8a6)" }} />
        <div style={{ padding: "6px 18px 8px", textAlign: "center" }}>
          <div
            style={{
              width: 58,
              height: 58,
              margin: "0 auto 6px",
              borderRadius: 16,
              background: "#fff",
              border: `1px solid ${C.border}`,
              boxShadow: "0 10px 24px rgba(15,23,42,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img src="/logo-icono.png" alt="Municipio" style={{ width: 44, height: 44, objectFit: "contain" }} />
          </div>

          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: ".12em" }}>MUNICIPALIDAD DE</div>
          <div style={{ fontSize: 16, color: C.slate, fontWeight: 800, marginTop: 2 }}>Banda del Río Salí</div>
          <div style={{ width: 72, height: 4, borderRadius: 999, background: "#14b8a6", margin: "5px auto" }} />

          <div
            style={{
              width: 58,
              height: 58,
              margin: "0 auto",
              borderRadius: 16,
              background: "#fff",
              border: `1px solid ${C.border}`,
              boxShadow: "0 10px 24px rgba(15,23,42,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={logoArea}
              alt="Logo del área"
              style={{
                width: 50,
                height: 50,
                objectFit: "contain",
                display: "block",
                background: "#fff",
                borderRadius: 14,
              }}
            />
          </div>

          <div style={{ marginTop: 5, fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: ".12em" }}>DIRECCIÓN DE</div>
          <div style={{ fontSize: 15, color: C.slate, fontWeight: 800, marginTop: 1 }}>Regularización Dominial y Hábitat</div>

          <div style={{ maxWidth: 520, margin: "5px auto 0", color: C.muted, fontSize: 10, lineHeight: 1.15 }}>
            Ingreso institucional al sistema interno de gestión de expedientes. Seleccioná el usuario autorizado e ingresá la contraseña.
          </div>

          <div style={{ maxWidth: 480, margin: "6px auto 0", display: "grid", gap: 6 }}>
            {LOGIN_USERS.map((user) => {
              const active = selectedUserId === user.id;
              const subtitle = getUserSubtitle(user);
              return (
                <button
                  key={user.id}
                  onClick={() => onSelectUser(user.id)}
                  style={{
                    textAlign: "left",
                    padding: "7px 14px",
                    borderRadius: 14,
                    border: `1px solid ${active ? "#7dd3fc" : C.border}`,
                    background: active ? "#f0f9ff" : "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: C.slate, fontWeight: 700 }}>{user.nombre}</div>
                    {subtitle ? (
                      <div style={{ marginTop: 1, fontSize: 10, color: C.muted }}>{subtitle}</div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      minWidth: 18,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: `2px solid ${active ? C.sky : "#cbd5e1"}`,
                      background: active ? C.sky : "#fff",
                      boxShadow: active ? "inset 0 0 0 4px #fff" : "none",
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div style={{ maxWidth: 480, margin: "6px auto 0", textAlign: "left" }}>
            <div style={{ ...labelStyle, marginBottom: 5 }}>Contraseña</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!loginLoading && selectedUserId) onIngresar();
              }}
            >
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder={selectedNeedsPassword ? "Ingresá la contraseña" : "Ingreso sin contraseña"}
                  style={{ ...inputStyle, background: "#fff", paddingRight: 38, paddingTop: 6, paddingBottom: 6 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: C.muted,
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
              <div style={{ marginTop: 3, fontSize: 9, color: C.dim, lineHeight: 1.1 }}>
                Para Estela, Carlos, Emmanuel y Andrés, la primera contraseña que cargues quedará registrada. Intendente y Usuario entran en modo consulta.
              </div>

              {selectedNeedsPassword ? (
                <div style={{ marginTop: 5, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" onClick={onOpenChangePassword} style={{ ...btnGhost, padding: "5px 10px", fontSize: 11 }}>
                    Cambiar contraseña
                  </button>
                  <button type="button" onClick={onOpenManualReset} style={{ ...btnGhost, padding: "5px 10px", fontSize: 11 }}>
                    Reset manual admin
                  </button>
                </div>
              ) : null}

              {loginError ? (
                <div
                  style={{
                    maxWidth: 480,
                    margin: "6px auto 0",
                    background: "#fef2f2",
                    color: "#991b1b",
                    border: "1px solid #fecaca",
                    borderRadius: 12,
                    padding: "8px 10px",
                    fontSize: 12,
                  }}
                >
                  {loginError}
                </div>
              ) : null}

              <div style={{ marginTop: 6, display: "flex", justifyContent: "center" }}>
                <button
                  type="submit"
                  disabled={loginLoading || !selectedUserId}
                  style={{
                    ...btnPrimary,
                    padding: "8px 22px",
                    fontSize: 13,
                    borderRadius: 12,
                    minWidth: 200,
                    opacity: loginLoading || !selectedUserId ? 0.7 : 1,
                    cursor: loginLoading || !selectedUserId ? "not-allowed" : "pointer",
                  }}
                >
                  {loginLoading ? "Ingresando..." : "Ingresar al panel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


const CERTIFICADO_ESTADOS = {
  pendiente: { label: "Pendiente", bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  notificado: { label: "Notificado", bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
  visitado: { label: "Visitado", bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
  listo: { label: "Listo para imprimir", bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  entregado: { label: "Entregado", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
};


function buildCertificadoPrintHtml(form, fecha, logoMunicipio, logoAreaPrint) {
  const fechaLarga = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `
<html>
<head>
<title>${form.numero || "Constancia de tenencia precaria"}</title>
<style>
@page {
  size: A4;
  margin: 1.5cm 1.6cm 1.6cm 1.6cm;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #fff;
  color: #000;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12pt;
  line-height: 1.35;
}
.page {
  width: 100%;
  max-width: 18cm;
  margin: 0 auto;
}
.header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
  column-gap: 1cm;
  margin-top: 0.25cm;
  margin-bottom: 1.2cm;
}
.logo-left,
.logo-right {
  height: 86px;
}
.logo-left {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
}
.logo-left img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  flex: 0 0 72px;
  display: block;
}
.logo-left-text {
  color: #9ca3af;
  font-size: 19px;
  line-height: 1.05;
  font-weight: 700;
}
.logo-left-text .city {
  font-size: 22px;
}
.logo-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  text-align: center;
  padding-top: 0;
}
.logo-right-inner {
  width: 235px;
  height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.logo-right img {
  width: 118px;
  height: 42px;
  object-fit: contain;
  display: block;
}
.logo-right-caption {
  margin-top: 4px;
  font-size: 6.5pt;
  letter-spacing: 1.2px;
  line-height: 1.15;
  text-transform: uppercase;
  white-space: nowrap;
}
.date {
  text-align: right;
  font-size: 12pt;
  margin-bottom: 0.45cm;
}
.presented-to {
  text-align: right;
  font-size: 11pt;
  margin-bottom: 0.8cm;
}
.presented-to strong {
  text-transform: uppercase;
}
.org-block {
  margin-bottom: 1.2cm;
  font-size: 13pt;
  font-weight: 700;
  text-transform: uppercase;
  color: #444;
  line-height: 1.65;
}
.title {
  text-align: center;
  font-size: 12pt;
  font-weight: 700;
  text-transform: uppercase;
  margin: 0 0 0.7cm 0;
}
.content {
  width: 15.9cm;
  margin-left: 0.25cm;
}
p {
  margin: 0 0 12pt 0;
  text-align: justify;
}
.indent {
  text-indent: 1.1cm;
}
.important {
  font-weight: 700;
  text-transform: uppercase;
}
.signature-block {
  margin-top: 2.1cm;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2cm;
  align-items: end;
}
.signature-line {
  border-top: 1px solid #000;
  padding-top: 6px;
  font-weight: 700;
  font-size: 10pt;
}
.signature-fields {
  display: grid;
  gap: 10px;
  font-weight: 700;
  font-size: 10pt;
}
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-left">
        <img src="${logoMunicipio}" />
        <div class="logo-left-text">
          <div>Municipalidad</div>
          <div class="city">Banda del Río Salí</div>
        </div>
      </div>
      <div class="logo-right">
        <div class="logo-right-inner">
          <img src="${logoAreaPrint}" />
          <div class="logo-right-caption">Dir. de Regularización Dominial y Hábitat<br/>La Banda del Río Salí</div>
        </div>
      </div>
    </div>

    <div class="date">Banda del Río Salí, ${fechaLarga}</div>

    <div class="org-block">
      <div>Municipio de La Banda del Río Salí</div>
      <div>Secretaría de Gobierno</div>
      <div>Dirección de Regularización Dominial y Hábitat</div>
    </div>

    <div class="title">Constancia de tenencia precaria</div>

    <div class="content">
      <p class="indent">
        La Dirección de Regularización Dominial y Hábitat del Municipio de Banda del Río Salí, otorga la presente Tenencia Precaria al Sr/a
        <span class="important">${form.vecinoNombre || "—"}</span>; DNI:<span class="important">${form.dni || "—"}</span>, con domicilio en calle:
        <span class="important">${form.domicilio || "—"}</span>; Barrio: <span class="important">${form.barrio || "—"}</span>. – Donde la propiedad se encuentra posicionada en una fracción del Padrón:
        <span class="important">${form.padronCatastral || "—"}</span>. Matrícula catastral: <span class="important">${form.matriculaCatastral || "—"}</span>. propietario Legal:
        <span class="important">${form.propietarioLegal || "—"}</span>.
      </p>

      <p class="indent">
        La presente tenencia es de carácter precario, personal e intransferible, y no confiere al/la tenedor/a ningún derecho real ni expectativa de dominio sobre el inmueble mencionado. El/la tenedor/a reconoce que la ocupación se encuentra permitida por razones sociales y de necesidad habitacional, y que la presente autorización administrativa no implica reconocimiento de derecho alguno sobre la titularidad dominial del bien.
      </p>

      <div class="signature-block">
        <div class="signature-fields">
          <div>Presentado ante: <strong>${form.presentadoAnte || "—"}</strong></div>
          <br/>
          <div>FIRMA SOLICITANTE:</div>
          <div>ACLARACIÓN:</div>
          <div>D.N.I.:</div>
        </div>
        <div class="signature-line">Firma y Sello del Responsable</div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
`;
}

function CertificadosSection({
  certificados,
  archivosByCertificado,
  canManageCertificados,
  activeUser,
  onCreate,
  onSave,
  onDelete,
  onUploadFiles,
  onDeleteFile,
  uploadingCertificadoId,
  deletingCertificadoFileId,
}) {
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedCertificados, setSelectedCertificados] = useState([]);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");

  const filtered = useMemo(() => {
    const needle = toSearchable(search);
    return (certificados || []).filter((cert) => {
      const matchSearch = !needle || [
        cert.numero,
        cert.vecinoNombre,
        cert.dni,
        cert.domicilio,
        cert.barrio,
        cert.telefono,
        cert.agenteNombre,
        cert.observaciones,
      ].some((value) => toSearchable(value).includes(needle));
      const matchEstado = !estado || cert.estado === estado;
      return matchSearch && matchEstado;
    });
  }, [certificados, search, estado]);

  const stats = useMemo(() => ({
    total: certificados.length,
    pendientes: certificados.filter((cert) => cert.estado === "pendiente").length,
    listos: certificados.filter((cert) => cert.estado === "listo" || cert.estado === "entregado").length,
    conArchivos: certificados.filter((cert) => (archivosByCertificado[cert.id] || []).length > 0).length,
  }), [certificados, archivosByCertificado]);

  const toggleSelectedCertificado = (certificadoId) => {
    setSelectedCertificados((prev) => (
      prev.includes(certificadoId)
        ? prev.filter((id) => id !== certificadoId)
        : [...prev, certificadoId]
    ));
  };

  const toggleAllVisibleCertificados = () => {
    const visibleIds = filtered.map((cert) => cert.id).filter(Boolean);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedCertificados.includes(id));
    setSelectedCertificados((prev) => {
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const printSelectedCertificados = () => {
    const selectedRows = certificados.filter((cert) => selectedCertificados.includes(cert.id));
    if (!selectedRows.length) return;
    selectedRows.forEach((cert, index) => {
      setTimeout(() => {
        const temp = { ...cert };
        const fecha = new Date().toLocaleDateString('es-AR');
        const logoMunicipio = `${window.location.origin}/logo-icono.png`;
        const logoAreaPrint = logoArea;
        const html = buildCertificadoPrintHtml(temp, fecha, logoMunicipio, logoAreaPrint);
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
        }
      }, index * 250);
    });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Constancias</h2>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Control de solicitudes, visitas, documentación e impresión.</div>
        </div>
        {canManageCertificados ? (
          <button onClick={() => setNuevoOpen(true)} style={btnPrimary}>+ Nueva constancia</button>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[["Constancias", stats.total, "Solicitudes registradas"], ["Pendientes", stats.pendientes, "Requieren gestión"], ["Listos / entregados", stats.listos, "Proceso avanzado"], ["Con archivos", stats.conArchivos, "Documentación cargada"]].map(([label, value, note]) => (
          <div key={label} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 18px" }}>
            <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: C.dim }}>{note}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vecino, DNI, domicilio, barrio o constancia..."
            style={{ ...inputStyle, flex: "1 1 420px", background: "#fff" }}
          />
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...inputStyle, width: 220, background: "#fff" }}>
            <option value="">Todos los estados</option>
            {Object.entries(CERTIFICADO_ESTADOS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
          <button onClick={() => { setSearch(""); setEstado(""); }} style={btnGhost}>Limpiar filtros</button>
          <button onClick={toggleAllVisibleCertificados} style={btnGhost}>Seleccionar visibles</button>
          <button
            onClick={printSelectedCertificados}
            disabled={!selectedCertificados.length}
            style={{ ...btnPrimary, opacity: selectedCertificados.length ? 1 : 0.55, cursor: selectedCertificados.length ? "pointer" : "not-allowed" }}
          >
            Imprimir seleccionados
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1280 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: C.dim, fontSize: 11, textTransform: "uppercase" }}>
                {["✓", "N° constancia", "Vecino", "DNI", "Domicilio", "Barrio", "Matrícula catastral", "Propietario legal", "Estado", "Archivos", "Agente", "Acciones"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((cert) => {
                const estadoCfg = CERTIFICADO_ESTADOS[cert.estado] || CERTIFICADO_ESTADOS.pendiente;
                const archivos = archivosByCertificado[cert.id] || [];
                return (
                  <tr key={cert.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input
                        type="checkbox"
                        checked={selectedCertificados.includes(cert.id)}
                        onChange={() => toggleSelectedCertificado(cert.id)}
                      />
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>{cert.numero || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{cert.vecinoNombre || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{cert.dni || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{cert.domicilio || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{cert.barrio || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{cert.matriculaCatastral || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{cert.propietarioLegal || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: estadoCfg.bg, color: estadoCfg.color, border: `1px solid ${estadoCfg.border}`, borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 700 }}>{estadoCfg.label}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{archivos.length}</td>
                    <td style={{ padding: "10px 12px" }}>{cert.agenteNombre || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => setSelected(cert)} style={{ ...btnPrimary, padding: "7px 12px", fontSize: 12 }}>Ver</button>
                        {canManageCertificados ? (
                          <button
                            onClick={async () => {
                              if (!confirm("¿Eliminar esta constancia?")) return;
                              const ok = await onDelete(cert.id);
                              if (ok && selected?.id === cert.id) setSelected(null);
                            }}
                            style={{ ...btnGhost, padding: "7px 12px", fontSize: 12, color: C.red, borderColor: "#fecaca" }}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={12} style={{ padding: 24 }}>
                    <EmptyBlock title="Sin constancias" text="Todavía no hay constancias cargadas o no coinciden con los filtros." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {nuevoOpen ? (
        <CertificadoModal
          mode="new"
          canManageCertificados={canManageCertificados}
          activeUser={activeUser}
          certificado={{
            numero: nextCertificadoNumber(certificados),
            vecinoNombre: "",
            dni: "",
            domicilio: "",
            barrio: "",
            padronCatastral: "",
            matriculaCatastral: "",
            propietarioLegal: "",
            telefono: "",
            motivo: "Constancia de tenencia precaria",
            presentadoAnte: "",
            estado: "pendiente",
            fechaVisita: "",
            observaciones: "",
            agenteNombre: activeUser?.nombre || "",
          }}
          archivos={[]}
          uploading={false}
          onClose={() => setNuevoOpen(false)}
          onSave={async (payload) => {
            const ok = await onCreate(payload);
            if (ok) setNuevoOpen(false);
            return ok;
          }}
          onUploadFiles={() => {}}
        />
      ) : null}

      {selected ? (
        <CertificadoModal
          mode="edit"
          canManageCertificados={canManageCertificados}
          activeUser={activeUser}
          certificado={selected}
          archivos={archivosByCertificado[selected.id] || []}
          uploading={uploadingCertificadoId === String(selected.id)}
          onClose={() => setSelected(null)}
          onSave={async (payload) => {
            const updated = await onSave(selected.id, payload);
            if (updated) setSelected(updated);
            return updated;
          }}
          onDelete={async () => {
            const ok = await onDelete(selected.id);
            if (ok) setSelected(null);
            return ok;
          }}
          onUploadFiles={(files) => onUploadFiles(selected.id, files)}
          onDeleteFile={(file) => onDeleteFile(selected.id, file)}
          deletingFileId={deletingCertificadoFileId}
        />
      ) : null}
    </div>
  );
}

function CertificadoModal({ mode, certificado, archivos, canManageCertificados, activeUser, uploading, onClose, onSave, onDelete, onUploadFiles, onDeleteFile, deletingFileId }) {
  const [form, setForm] = useState(certificado);
  const [localError, setLocalError] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  useEffect(() => {
    setForm(certificado);
    setLocalError("");
    setActionNotice("");
  }, [certificado?.id, mode]);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    setLocalError("");
    setActionNotice("");
    if (!cleanText(form.vecinoNombre)) return setLocalError("Ingresa el nombre del vecino.");
    if (!cleanText(form.dni)) return setLocalError("Ingresa el DNI.");
    if (!cleanText(form.domicilio)) return setLocalError("Ingresa el domicilio.");
    const result = await onSave(form);
    if (result) setActionNotice(mode === "edit" ? "Cambios guardados correctamente." : "Constancia guardada correctamente.");
  };

  const printCertificado = () => {
    setActionNotice("Impresión preparada correctamente.");
    const fecha = new Date().toLocaleDateString('es-AR');
    const logoMunicipio = `${window.location.origin}/logo-icono.png`;
    const logoAreaPrint = logoArea;
    const html = buildCertificadoPrintHtml(form, fecha, logoMunicipio, logoAreaPrint);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)", overflowY: "auto", padding: 14 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980, margin: "20px auto", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 80px rgba(15,23,42,.18)" }}>
        <div style={{ background: "linear-gradient(135deg,#0ea5e9,#14b8a6)", padding: "18px 22px", color: "#fff", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", opacity: 0.85 }}>Constancia de tenencia precaria</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{form.numero || "Nueva constancia"}</div>
          </div>
          <button onClick={onClose} {...buttonHoverHandlers} style={{ ...btnGhost, ...interactiveButtonStyle, background: "rgba(255,255,255,.15)", color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>Cerrar</button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          {localError ? <div style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 12, padding: 10, fontSize: 13 }}>{localError}</div> : null}
          {actionNotice ? <div style={{ background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 700 }}>{actionNotice}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <div style={labelStyle}>N° constancia</div>
              <input value={form.numero || ""} disabled={!canManageCertificados} onChange={(e) => set("numero", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Estado</div>
              <select value={form.estado || "pendiente"} disabled={!canManageCertificados} onChange={(e) => set("estado", e.target.value)} style={inputStyle}>
                {Object.entries(CERTIFICADO_ESTADOS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Nombre del vecino</div>
              <input value={form.vecinoNombre || ""} disabled={!canManageCertificados} onChange={(e) => set("vecinoNombre", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>DNI</div>
              <input value={form.dni || ""} disabled={!canManageCertificados} onChange={(e) => set("dni", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Domicilio</div>
              <input value={form.domicilio || ""} disabled={!canManageCertificados} onChange={(e) => set("domicilio", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Barrio</div>
              <input value={form.barrio || ""} disabled={!canManageCertificados} onChange={(e) => set("barrio", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Padrón catastral</div>
              <input value={form.padronCatastral || ""} disabled={!canManageCertificados} onChange={(e) => set("padronCatastral", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Matrícula catastral</div>
              <input value={form.matriculaCatastral || ""} disabled={!canManageCertificados} onChange={(e) => set("matriculaCatastral", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Propietario legal</div>
              <input value={form.propietarioLegal || ""} disabled={!canManageCertificados} onChange={(e) => set("propietarioLegal", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Teléfono/contacto</div>
              <input value={form.telefono || ""} disabled={!canManageCertificados} onChange={(e) => set("telefono", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Fecha de visita</div>
              <input type="date" value={form.fechaVisita || ""} disabled={!canManageCertificados} onChange={(e) => set("fechaVisita", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Motivo</div>
              <input value={form.motivo || ""} disabled={!canManageCertificados} onChange={(e) => set("motivo", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Presentado ante</div>
              <input value={form.presentadoAnte || ""} disabled={!canManageCertificados} onChange={(e) => set("presentadoAnte", e.target.value)} placeholder="Ej: Sra. concejal Medina, Claudia" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Agente</div>
              <input value={form.agenteNombre || ""} disabled={!canManageCertificados} onChange={(e) => set("agenteNombre", e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <div style={labelStyle}>Observaciones</div>
            <textarea value={form.observaciones || ""} disabled={!canManageCertificados} onChange={(e) => set("observaciones", e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {mode === "edit" ? (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>Documentación adjunta</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Boleta de luz, fotocopia DNI u otros comprobantes.</div>
                </div>
                {canManageCertificados ? (
                  <label {...buttonHoverHandlers} style={{ ...btnGhost, ...interactiveButtonStyle, display: "inline-flex", alignItems: "center", gap: 8, cursor: uploading ? "not-allowed" : "pointer" }}>
                    {uploading ? "Subiendo..." : "Subir archivos"}
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                      multiple
                      style={{ display: "none" }}
                      disabled={uploading}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) {
                          setActionNotice("Subiendo documentación...");
                          await onUploadFiles(files);
                          setActionNotice(files.length === 1 ? "Archivo cargado correctamente." : "Archivos cargados correctamente.");
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
              </div>

              {archivos.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {archivos.map((file) => (
                    <div key={file.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{file.nombreOriginal}</div>
                        <div style={{ color: C.dim, fontSize: 12 }}>
                          {file.createdAt ? `Cargado: ${formatDateTime(file.createdAt)}` : "Cargado: sin fecha"} • Peso: {file.tamanoBytes ? formatFileSize(file.tamanoBytes) : "no registrado"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <a href={file.publicUrl} target="_blank" rel="noreferrer" onClick={() => setActionNotice("Archivo abierto en una nueva pestaña.")} style={{ color: C.sky, fontWeight: 700, textDecoration: "none" }}>Abrir</a>
                        {canManageCertificados ? (
                          <button
                            type="button"
                            disabled={deletingFileId === String(file.id)}
                            onClick={async () => {
                              if (!confirm("¿Eliminar este archivo?")) return;
                              const ok = await onDeleteFile(file);
                              if (ok) setActionNotice("Archivo eliminado correctamente.");
                            }}
                            {...buttonHoverHandlers}
                            style={{ ...btnGhost, ...interactiveButtonStyle, padding: "6px 10px", fontSize: 12, color: C.red, borderColor: "#fecaca", opacity: deletingFileId === String(file.id) ? 0.6 : 1 }}
                          >
                            {deletingFileId === String(file.id) ? "Eliminando..." : "Eliminar"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: C.dim, fontSize: 13 }}>Sin documentación adjunta.</div>}
            </div>
          ) : (
            <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, color: C.muted, fontSize: 13 }}>
              Primero guarda la constancia. Después vas a poder subir la documentación adjunta.
            </div>
          )}

          {actionNotice ? (
            <div style={{ background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>
              {actionNotice}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canManageCertificados ? <button onClick={submit} {...buttonHoverHandlers} style={{ ...btnPrimary, ...interactiveButtonStyle }}>Guardar constancia</button> : null}
              <button onClick={printCertificado} {...buttonHoverHandlers} style={{ ...btnGhost, ...interactiveButtonStyle }}>Imprimir constancia</button>
              {mode === "edit" && canManageCertificados ? (
                <button
                  onClick={async () => {
                    if (!confirm("¿Eliminar esta constancia?")) return;
                    const ok = await onDelete();
                    if (ok) window.alert("Constancia eliminada correctamente.");
                  }}
                  {...buttonHoverHandlers}
                  style={{ ...btnGhost, ...interactiveButtonStyle, color: C.red, borderColor: "#fecaca" }}
                >
                  Eliminar constancia
                </button>
              ) : null}
            </div>
            <button onClick={onClose} {...buttonHoverHandlers} style={{ ...btnGhost, ...interactiveButtonStyle }}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordAdminModal({ open, mode = "change", selectedUserId, onClose, onSubmit, loading, error }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [targetUserId, setTargetUserId] = useState(LOGIN_USERS.find((user) => user.id === selectedUserId && user.requiresPassword)?.id || "estela-palacios");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setLocalError("");
      setTargetUserId(LOGIN_USERS.find((user) => user.id === selectedUserId && user.requiresPassword)?.id || "estela-palacios");
      setShowCurrent(false);
      setShowNext(false);
      setShowConfirm(false);
    }
  }, [open, selectedUserId, mode]);

  if (!open) return null;

  const title = mode === "change" ? "Cambiar contraseña" : "Reset manual admin";
  const helper = mode === "change"
    ? "Ingresá la contraseña actual y definí la nueva."
    : "Usá esta opción para resetear la clave manualmente para Estela, Carlos, Emmanuel o Andrés.";

  const submit = () => {
    setLocalError("");
    if (!nextPassword || nextPassword.length < 4) {
      setLocalError("La nueva contraseña debe tener al menos 4 caracteres.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      setLocalError("La confirmación no coincide.");
      return;
    }
    if (mode === "change" && !currentPassword) {
      setLocalError("Ingresá la contraseña actual.");
      return;
    }
    onSubmit({ targetUserId, currentPassword, nextPassword });
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.35)", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, margin: "0 16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
        <div style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)", padding: "18px 20px", color: "#fff" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#bae6fd", marginTop: 4 }}>{helper}</div>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 12 }}>
          {mode === "reset" ? (
            <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} style={inputStyle}>
              {LOGIN_USERS.filter((user) => user.requiresPassword).map((user) => (
                <option key={user.id} value={user.id}>{user.nombre}</option>
              ))}
            </select>
          ) : (
            <div style={{ ...inputStyle, background: "#f8fafc", display: "flex", alignItems: "center", minHeight: 42 }}>
              {LOGIN_USERS.find((u) => u.id === selectedUserId)?.nombre || "Usuario"}
            </div>
          )}

          {mode === "change" ? (
            <div style={{ position: "relative" }}>
              <input type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Contraseña actual" style={{ ...inputStyle, paddingRight: 44, background: "#fff" }} />
              <button type="button" onClick={() => setShowCurrent((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: C.muted, fontSize: 18, padding: 0 }}>{showCurrent ? "🙈" : "👁"}</button>
            </div>
          ) : null}

          <div style={{ position: "relative" }}>
            <input type={showNext ? "text" : "password"} value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} placeholder="Nueva contraseña" style={{ ...inputStyle, paddingRight: 44, background: "#fff" }} />
            <button type="button" onClick={() => setShowNext((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: C.muted, fontSize: 18, padding: 0 }}>{showNext ? "🙈" : "👁"}</button>
          </div>

          <div style={{ position: "relative" }}>
            <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar nueva contraseña" style={{ ...inputStyle, paddingRight: 44, background: "#fff" }} />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: C.muted, fontSize: 18, padding: 0 }}>{showConfirm ? "🙈" : "👁"}</button>
          </div>

          {localError ? <div style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}>{localError}</div> : null}
          {error ? <div style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}>{error}</div> : null}
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhost} disabled={loading}>Cancelar</button>
          <button onClick={submit} style={btnPrimary} disabled={loading}>{loading ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

const PERSONA_24374_VACIA = { nombre: "", dni: "", cuil: "", telefono: "", domicilio: "", ciudad: "", estadoCivil: "" };

function buildFormulario24374Form(expediente) {
  const zona = splitBarrio(expediente?.barrio);
  const localidad = zona.localidad || "Banda del Río Salí";
  const domicilio = zona.barrio && !/^(barrio|b°)/i.test(zona.barrio) ? `B° ${zona.barrio}` : zona.barrio;
  return {
    fecha: new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    solicitante1: { ...PERSONA_24374_VACIA, nombre: expediente?.titular || "", dni: expediente?.dni || "", telefono: expediente?.telefono || "", estadoCivil: expediente?.estadoCivil || "", domicilio, ciudad: localidad },
    conyuge1: { ...PERSONA_24374_VACIA },
    solicitante2: { ...PERSONA_24374_VACIA },
    conyuge2: { ...PERSONA_24374_VACIA },
    ubicacion: "interior",
    inmuebleDomicilio: [domicilio, localidad].filter(Boolean).join(", "),
    circ: "",
    secc: "",
    mzna: "",
    parcela: "",
    padron: expediente?.padronNumero || "",
    matricula: "",
    orden: "",
    antecedente: "",
    incluirAnexo: false,
  };
}

// Posiciones medidas sobre el PDF original de Catastro (puntos, origen arriba a la izquierda).
// "y" es el borde inferior de la etiqueta impresa; el valor se escribe sobre esa misma línea punteada.
const FORMULARIO_24374_URL = "/formularios/ley-24374-solicitud.pdf";
const FORMULARIO_24374_FILAS = {
  solicitante1: [223.4, 237.6, 251.8, 266.0],
  conyuge1: [304.2, 318.4],
  solicitante2: [360.7, 374.9, 389.2, 403.4],
  conyuge2: [440.4, 454.6],
};
const FORMULARIO_24374_PERSONA_CAMPOS = [
  { field: "nombre", fila: 0, x0: 172, x1: 566 },
  { field: "dni", fila: 1, x0: 101, x1: 190 },
  { field: "cuil", fila: 1, x0: 224, x1: 313 },
  { field: "telefono", fila: 1, x0: 339, x1: 566 },
  { field: "domicilio", fila: 2, x0: 127, x1: 314 },
  { field: "ciudad", fila: 2, x0: 357, x1: 566 },
  { field: "estadoCivil", fila: 3, x0: 140, x1: 566 },
];
const FORMULARIO_24374_INMUEBLE_CAMPOS = [
  { field: "inmuebleDomicilio", y: 545.4, x0: 127, x1: 566 },
  { field: "circ", y: 587.4, x0: 101, x1: 161 },
  { field: "secc", y: 587.4, x0: 193, x1: 253 },
  { field: "mzna", y: 587.4, x0: 284, x1: 368 },
  { field: "parcela", y: 587.4, x0: 410, x1: 566 },
  { field: "padron", y: 602.3, x0: 117, x1: 232 },
  { field: "matricula", y: 602.3, x0: 282, x1: 372 },
  { field: "orden", y: 602.3, x0: 407, x1: 566 },
  { field: "antecedente", y: 617.2, x0: 202, x1: 566 },
];

async function buildFormulario24374Pdf(form) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const original = await fetch(FORMULARIO_24374_URL).then((res) => {
    if (!res.ok) throw new Error("No se pudo cargar el formulario original.");
    return res.arrayBuffer();
  });
  const pdf = await PDFDocument.load(original);
  if (!form.incluirAnexo) pdf.removePage(1);
  const page = pdf.getPage(0);
  const alto = page.getHeight();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const escribir = (value, x0, x1, y) => {
    // Helvetica estándar solo admite Latin-1: se descartan caracteres fuera de ese rango.
    const text = cleanText(value).toUpperCase().replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
    if (!text) return;
    let size = 10;
    while (size > 6 && font.widthOfTextAtSize(text, size) > x1 - x0) size -= 0.5;
    page.drawText(text, { x: x0, y: alto - (y - 4), size, font, color: rgb(0, 0, 0) });
  };

  const [dia = "", mes = "", anio = ""] = cleanText(form.fecha).split("/");
  escribir(dia, 452, 473, 150.9);
  escribir(mes, 481, 500, 150.9);
  escribir(anio, 508, 545, 150.9);

  Object.entries(FORMULARIO_24374_FILAS).forEach(([persona, filas]) => {
    FORMULARIO_24374_PERSONA_CAMPOS.forEach(({ field, fila, x0, x1 }) => {
      if (filas[fila] !== undefined) escribir(form[persona]?.[field], x0, x1, filas[fila]);
    });
  });

  FORMULARIO_24374_INMUEBLE_CAMPOS.forEach(({ field, y, x0, x1 }) => escribir(form[field], x0, x1, y));

  const casilla = form.ubicacion === "capital" ? { x: 364.4 } : form.ubicacion === "interior" ? { x: 495.1 } : null;
  if (casilla) page.drawText("X", { x: casilla.x - 3.7, y: alto - 520.4, size: 11, font, color: rgb(0, 0, 0) });

  return pdf.save();
}

function Formulario24374Modal({ expediente, onClose }) {
  const [form, setForm] = useState(() => buildFormulario24374Form(expediente));
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setPersona = (persona, field, value) => setForm((prev) => ({ ...prev, [persona]: { ...prev[persona], [field]: value } }));

  const [generando, setGenerando] = useState(false);
  const [errorPdf, setErrorPdf] = useState("");

  const imprimir = async () => {
    // La pestaña se abre antes de generar el PDF para que el navegador no la bloquee.
    const win = window.open("", "_blank");
    setGenerando(true);
    setErrorPdf("");
    try {
      const bytes = await buildFormulario24374Pdf(form);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      if (win) win.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      if (win) win.close();
      setErrorPdf(err?.message || "No se pudo generar el formulario.");
    } finally {
      setGenerando(false);
    }
  };

  const personaCampos = (persona, titulo, completa) => (
    <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.slate, marginBottom: 8 }}>{titulo}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        <div style={{ gridColumn: "1 / -1" }}><div style={labelStyle}>Apellido y nombre</div><input value={form[persona].nombre} onChange={(e) => setPersona(persona, "nombre", e.target.value)} style={inputStyle} /></div>
        <div><div style={labelStyle}>DNI</div><input value={form[persona].dni} onChange={(e) => setPersona(persona, "dni", e.target.value)} style={inputStyle} /></div>
        <div><div style={labelStyle}>CUIL</div><input value={form[persona].cuil} onChange={(e) => setPersona(persona, "cuil", e.target.value)} style={inputStyle} /></div>
        <div><div style={labelStyle}>Teléfono</div><input value={form[persona].telefono} onChange={(e) => setPersona(persona, "telefono", e.target.value)} style={inputStyle} /></div>
        {completa ? (
          <>
            <div><div style={labelStyle}>Domicilio</div><input value={form[persona].domicilio} onChange={(e) => setPersona(persona, "domicilio", e.target.value)} style={inputStyle} /></div>
            <div><div style={labelStyle}>Ciudad</div><input value={form[persona].ciudad} onChange={(e) => setPersona(persona, "ciudad", e.target.value)} style={inputStyle} /></div>
            <div><div style={labelStyle}>Estado civil</div><select value={form[persona].estadoCivil} onChange={(e) => setPersona(persona, "estadoCivil", e.target.value)} style={inputStyle}>{ESTADOS_CIVILES.map((x) => <option key={x} value={x}>{x || "Seleccionar"}</option>)}</select></div>
          </>
        ) : null}
      </div>
    </div>
  );

  const campo = (field, label) => (
    <div><div style={labelStyle}>{label}</div><input value={form[field]} onChange={(e) => set(field, e.target.value)} style={inputStyle} /></div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)", overflowY: "auto", padding: 14 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980, margin: "20px auto", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 80px rgba(15,23,42,.18)" }}>
        <div style={{ background: "linear-gradient(135deg,#0ea5e9,#14b8a6)", padding: "18px 22px", color: "#fff", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", opacity: 0.85 }}>Solicitud de adhesión · Ley 24.374</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{expediente?.num}</div>
          </div>
          <button onClick={onClose} {...buttonHoverHandlers} style={{ ...btnGhost, ...interactiveButtonStyle, background: "rgba(255,255,255,.15)", color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>Cerrar</button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 12 }}>
          <div style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 14px", fontSize: 13 }}>
            Los datos del expediente ya vienen cargados. Se imprime sobre el formulario original de Catastro: completá lo que falte o dejalo vacío para llenarlo a mano en la visita. Lo que se escriba acá no se guarda en el expediente.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>{campo("fecha", "Fecha")}</div>

          {personaCampos("solicitante1", "Solicitante 1", true)}
          {personaCampos("conyuge1", "Cónyuge y/o conviviente del solicitante 1", false)}
          {personaCampos("solicitante2", "Solicitante 2 (solo si es condominio)", true)}
          {personaCampos("conyuge2", "Cónyuge y/o conviviente del solicitante 2", false)}

          <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.slate, marginBottom: 8 }}>Datos del inmueble</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              <div><div style={labelStyle}>Ubicación</div><select value={form.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} style={inputStyle}><option value="">Sin marcar</option><option value="capital">Capital</option><option value="interior">Interior</option></select></div>
              <div style={{ gridColumn: "span 3" }}>{campo("inmuebleDomicilio", "Domicilio del inmueble")}</div>
              {campo("circ", "Circunscripción")}
              {campo("secc", "Sección")}
              {campo("mzna", "Manzana")}
              {campo("parcela", "Parcela")}
              {campo("padron", "Padrón")}
              {campo("matricula", "Matrícula")}
              {campo("orden", "Orden")}
              <div />
              <div style={{ gridColumn: "1 / -1" }}>{campo("antecedente", "Antecedente de dominio")}</div>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.slate, cursor: "pointer" }}>
            <input type="checkbox" checked={form.incluirAnexo} onChange={(e) => set("incluirAnexo", e.target.checked)} />
            Agregar Anexo I en blanco (para más de dos solicitantes)
          </label>
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
          {errorPdf ? <span style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>{errorPdf}</span> : null}
          <button onClick={onClose} {...buttonHoverHandlers} style={{ ...btnGhost, ...interactiveButtonStyle }}>Cancelar</button>
          <button onClick={imprimir} disabled={generando} {...buttonHoverHandlers} style={{ ...btnPrimary, ...interactiveButtonStyle, opacity: generando ? 0.7 : 1 }}>{generando ? "Generando..." : "Imprimir formulario"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalExpediente({ item, users, usersMap, onClose, onSaveField, savingField, onUploadPlano, onDeletePlano, uploadingPlano, deletingPlanoId, canEdit, onDelete, planos = [], onNext, modalIndex = 0, modalTotal = 0, activeUser, observacionesIntendente = [], onAddObservacionIntendente, addingObservacionIntendente, existingExpedientes = [], onDuplicatePadron }) {
  const [draft, setDraft] = useState(item || null);
  const [observacionIntendenteDraft, setObservacionIntendenteDraft] = useState("");
  const [showFormulario24374, setShowFormulario24374] = useState(false);

  useEffect(() => {
    setDraft(item || null);
    setObservacionIntendenteDraft("");
    setShowFormulario24374(false);
  }, [item]);

  if (!draft) return null;

  const zona = splitBarrio(draft.barrio);
  const saving = savingField === String(draft.id);
  const barrios = BARRIOS[zona.localidad || "Banda del Río Salí"] || ALL_BARRIOS;
  const modalFiles = planos.length ? planos : (draft.planoUrl ? [{ id: `legacy-${draft.id}`, nombreOriginal: draft.planoPath || "Archivo cargado", publicUrl: draft.planoUrl, tamanoBytes: 0, createdAt: draft.upd, tipoMime: "" }] : []);
  const completeness = getExpedienteCompleteness(draft, modalFiles);
  const warnings = getExpedienteWarnings(draft, modalFiles);

  const updateField = (field, value) => {
    if (field === "padronNumero") {
      const duplicatedPadron = findDuplicatePadron(existingExpedientes, value, draft.id);
      if (duplicatedPadron) {
        onDuplicatePadron?.(value, duplicatedPadron);
        return;
      }
    }

    const next = { ...draft, [field]: value };
    setDraft(next);
    if (canEdit) onSaveField(draft.id, { [field]: value });
  };

  const updateZona = (part, value) => {
    const nextZona = { ...zona, [part]: value };
    if (part === "localidad" && !nextZona.barrio) nextZona.barrio = (BARRIOS[value] || [])[0] || "";
    updateField("barrio", composeBarrio(nextZona.localidad || "Banda del Río Salí", nextZona.barrio || ""));
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,.35)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 1080,
          margin: "0 16px",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,.15)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)", padding: "20px 24px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, color: "#bae6fd", fontWeight: 600, textTransform: "uppercase" }}>Expediente</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 3 }}>{draft.num}</div>
              {modalTotal > 0 ? <div style={{ fontSize: 12, color: "#e0f2fe", marginTop: 4 }}>Expediente {modalIndex + 1} de {modalTotal}</div> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {saving ? <span style={{ fontSize: 12, color: "#e0f2fe" }}>Guardando…</span> : null}
              {!canEdit ? <span style={{ fontSize: 12, color: "#e0f2fe" }}>Solo lectura</span> : null}
              <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#bae6fd", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
          </div>
        </div>

        <div style={{ padding: 20, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
            <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}><div style={labelStyle}>Estado</div><div><Badge estado={draft.estado} /></div></div>
            <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}><div style={labelStyle}>Ubicación</div><div style={{ fontWeight: 700, fontSize: 13 }}>{draft.resp || "Sin asignar"}</div></div>
            <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}><div style={labelStyle}>Nivel de carga</div><div><CompletenessBadge expediente={draft} attachments={modalFiles} /></div></div>
            <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}><div style={labelStyle}>Archivos</div><div style={{ fontWeight: 700, fontSize: 13 }}>{modalFiles.length}</div></div>
          </div>

          {warnings.length ? (
            <div style={{ marginBottom: 14, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Alertas inteligentes</div>
              <div style={{ display: "grid", gap: 4, fontSize: 13 }}>{warnings.map((warning) => <div key={warning}>• {warning}</div>)}</div>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div><div style={labelStyle}>Titular</div><input value={draft.titular} disabled={!canEdit} onChange={(e) => updateField("titular", e.target.value)} style={inputStyle} /></div>
            <div><div style={labelStyle}>DNI</div><input value={draft.dni} disabled={!canEdit} onChange={(e) => updateField("dni", e.target.value)} style={inputStyle} /></div>
            <div><div style={labelStyle}>Contacto</div><input value={draft.telefono || ""} disabled={!canEdit} onChange={(e) => updateField("telefono", e.target.value)} style={inputStyle} /></div>
            <div><div style={labelStyle}>Estado civil</div><select value={draft.estadoCivil} disabled={!canEdit} onChange={(e) => updateField("estadoCivil", e.target.value)} style={inputStyle}>{ESTADOS_CIVILES.map((x) => <option key={x} value={x}>{x || "Seleccionar"}</option>)}</select></div>
            <div><div style={labelStyle}>Localidad</div><select value={zona.localidad || "Banda del Río Salí"} disabled={!canEdit} onChange={(e) => updateZona("localidad", e.target.value)} style={inputStyle}>{LOCALIDADES.map((loc) => <option key={loc} value={loc}>{loc}</option>)}</select></div>
            <div><div style={labelStyle}>Barrio</div><select value={zona.barrio || ""} disabled={!canEdit} onChange={(e) => updateZona("barrio", e.target.value)} style={inputStyle}><option value="">Seleccionar</option>{barrios.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
            <div><div style={labelStyle}>N° de padrón</div><input value={draft.padronNumero} disabled={!canEdit} onChange={(e) => updateField("padronNumero", e.target.value)} style={inputStyle} /></div>
            <div><div style={labelStyle}>Estado</div><select value={draft.estado} disabled={!canEdit} onChange={(e) => updateField("estado", e.target.value)} style={{ ...inputStyle, background: (ESTADOS[draft.estado] || ESTADOS.pendiente).bg, color: (ESTADOS[draft.estado] || ESTADOS.pendiente).color, borderColor: (ESTADOS[draft.estado] || ESTADOS.pendiente).border, fontWeight: 700 }}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><div style={labelStyle}>Área</div><select value={draft.area} disabled={!canEdit} onChange={(e) => updateField("area", e.target.value)} style={inputStyle}>{AREAS.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
            <div><div style={labelStyle}>Ubicación</div><select value={draft.resp} disabled={!canEdit} onChange={(e) => updateField("resp", e.target.value)} style={inputStyle}>{UBICACIONES.map((u) => <option key={u} value={u}>{u || "Sin asignar"}</option>)}</select></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={labelStyle}>Notas internas</div>
              <textarea value={draft.notas} disabled={!canEdit} onChange={(e) => updateField("notas", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1 / -1", background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.slate, fontWeight: 800 }}>Observaciones del Intendente</div>
                  <div style={{ marginTop: 3, fontSize: 11, color: C.dim }}>Historial ejecutivo separado de las notas internas.</div>
                </div>
                {activeUser?.canAddExecutiveNotes ? <span style={{ fontSize: 11, color: C.indigo, fontWeight: 700 }}>Puede agregar observaciones</span> : null}
              </div>

              {activeUser?.canAddExecutiveNotes ? (
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  <textarea value={observacionIntendenteDraft} onChange={(e) => setObservacionIntendenteDraft(e.target.value)} rows={3} placeholder="Escribir observación ejecutiva..." style={{ ...inputStyle, resize: "vertical", background: "#fff" }} />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={async () => { if (!cleanText(observacionIntendenteDraft) || !onAddObservacionIntendente) return; const ok = await onAddObservacionIntendente(draft.id, observacionIntendenteDraft); if (ok) setObservacionIntendenteDraft(""); }} disabled={addingObservacionIntendente || !cleanText(observacionIntendenteDraft)} style={{ ...btnPrimary, opacity: addingObservacionIntendente || !cleanText(observacionIntendenteDraft) ? 0.7 : 1 }}>
                      {addingObservacionIntendente ? "Guardando..." : "Guardar observación"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 8 }}>
                {observacionesIntendente.length === 0 ? (
                  <div style={{ color: C.dim, fontSize: 12 }}>Todavía no hay observaciones del Intendente.</div>
                ) : observacionesIntendente.map((obs) => (
                  <div key={obs.id} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: C.slate, fontSize: 13 }}>{obs.autorNombre} · {obs.autorRol}</div>
                      <div style={{ color: C.dim, fontSize: 11 }}>{formatDateTime(obs.createdAt)}</div>
                    </div>
                    <div style={{ marginTop: 7, color: C.text, fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{obs.observacion}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={labelStyle}>Archivos adjuntos</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
                {canEdit ? (
                  <label style={{ ...btnGhost, display: "inline-flex", alignItems: "center", gap: 8, cursor: uploadingPlano ? "not-allowed" : "pointer" }}>
                    {uploadingPlano ? "Subiendo..." : "Subir archivos"}
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                      multiple
                      style={{ display: "none" }}
                      disabled={uploadingPlano}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) onUploadPlano(draft.id, files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
                <span style={{ color: C.dim, fontSize: 12 }}>Máximo {MAX_PLANO_FILE_SIZE_MB} MB por archivo • JPG, PNG, WEBP, PDF, DOC, DOCX, XLS, XLSX, CSV</span>
              </div>

              {modalFiles.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {modalFiles.map((plano) => (
                    <div key={plano.id} style={{ background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.slate }}>{plano.nombreOriginal || "Archivo"}</div>
                          <span style={{ fontSize: 10, color: C.dim, border: `1px solid ${C.border}`, borderRadius: 999, padding: "1px 6px" }}>{getAttachmentLabel(plano.nombreOriginal, plano.tipoMime)}</span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: C.dim }}>
                          {plano.createdAt ? `Cargado: ${formatDateTime(plano.createdAt)}` : "Cargado: sin fecha"}
                          {" • "}
                          {`Peso: ${plano.tamanoBytes ? formatFileSize(plano.tamanoBytes) : "no registrado"}`}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <a href={plano.publicUrl} target="_blank" rel="noreferrer" style={{ color: C.sky, fontWeight: 700, textDecoration: "none", fontSize: 12 }}>Abrir</a>
                        <a href={plano.publicUrl} download style={{ color: C.sky, fontWeight: 700, textDecoration: "none", fontSize: 12 }}>Descargar</a>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => onDeletePlano(draft.id, plano)}
                            disabled={deletingPlanoId === String(plano.id || draft.id)}
                            style={{ border: "none", background: "transparent", color: C.red, fontWeight: 700, cursor: deletingPlanoId === String(plano.id || draft.id) ? "not-allowed" : "pointer", opacity: deletingPlanoId === String(plano.id || draft.id) ? 0.6 : 1, padding: 0 }}
                          >
                            {deletingPlanoId === String(plano.id || draft.id) ? "Eliminando..." : "Eliminar"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ color: C.dim, fontSize: 12 }}>Sin archivos adjuntos</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canEdit ? <button onClick={() => onDelete(draft)} {...buttonHoverHandlers}
                  style={{ ...btnGhost, ...interactiveButtonStyle, color: C.red, borderColor: "#fecaca" }}>Eliminar expediente</button> : null}
            {onNext ? <button onClick={onNext} style={btnGhost}>Siguiente expediente</button> : null}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setShowFormulario24374(true)} {...buttonHoverHandlers} style={{ ...btnPrimary, ...interactiveButtonStyle }}>Formulario Ley 24.374</button>
            <button onClick={onClose} {...buttonHoverHandlers} style={{ ...btnGhost, ...interactiveButtonStyle }}>Cerrar</button>
          </div>
        </div>
      </div>
      {showFormulario24374 ? <div onClick={(e) => e.stopPropagation()}><Formulario24374Modal expediente={draft} onClose={() => setShowFormulario24374(false)} /></div> : null}
    </div>
  );
}

function NuevoExpedienteModal({ open, onClose, onSave, saving, users, existingExpedientes = [] }) {
  const [form, setForm] = useState({
    titular: "",
    dni: "",
    telefono: "",
    localidad: "Banda del Río Salí",
    barrioSeleccionado: "",
    barrioManual: "",
    estadoCivil: "",
    padronNumero: "",
    estado: "revision_inicial",
    area: "",
    resp: "",
    notas: "",
  });
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) {
      setForm({
        titular: "",
        dni: "",
        telefono: "",
        localidad: "Banda del Río Salí",
        barrioSeleccionado: "",
        barrioManual: "",
        estadoCivil: "",
        padronNumero: "",
        estado: "revision_inicial",
        area: "",
        resp: "",
        notas: "",
      });
      setValidationError("");
    }
  }, [open]);

  if (!open) return null;

  const barrios = BARRIOS[form.localidad] || [];
  const barrioFinal = form.barrioSeleccionado === "Otro" ? form.barrioManual.trim() : form.barrioSeleccionado;
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const duplicatedPadron = findDuplicatePadron(existingExpedientes, form.padronNumero);

  const guardar = () => {
    const currentDuplicatedPadron = findDuplicatePadron(existingExpedientes, form.padronNumero);

    if (currentDuplicatedPadron) {
      setValidationError(`El padrón ${cleanText(form.padronNumero)} ya existe en ${currentDuplicatedPadron.num || "otro expediente"} (${currentDuplicatedPadron.titular || "sin titular"}). No se puede cargar duplicado.`);
      return;
    }

    if (!form.titular.trim() || !form.area) {
      setValidationError("Completá titular y área.");
      return;
    }
    if (!barrioFinal) {
      setValidationError("Seleccioná o escribí un barrio.");
      return;
    }
    setValidationError("");
    onSave({
      titular: form.titular,
      dni: form.dni,
      telefono: form.telefono,
      localidad: form.localidad,
      barrio: barrioFinal,
      estadoCivil: form.estadoCivil,
      padronNumero: form.padronNumero,
      estado: form.estado,
      area: form.area,
      resp: form.resp,
      notas: form.notas,
    });
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.35)", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, margin: "0 16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
        <div style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)", padding: "20px 22px", color: "#fff" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Nuevo expediente</div>
          <div style={{ fontSize: 12, color: "#bae6fd", marginTop: 4 }}>Carga inicial del expediente</div>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 12 }}>
          {validationError ? <div style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 8px", fontSize: 12 }}>{validationError}</div> : null}
          {duplicatedPadron ? <div style={{ background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 8px", fontSize: 12, fontWeight: 700 }}>Padrón ya existente: {duplicatedPadron.num || "expediente sin número"} · {duplicatedPadron.titular || "sin titular"}</div> : null}
          <input value={form.titular} onChange={(e) => set("titular", e.target.value)} placeholder="Nombre del titular" style={inputStyle} />
          <input value={form.dni} onChange={(e) => set("dni", e.target.value)} placeholder="DNI" style={inputStyle} />
          <input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="Contacto / teléfono" style={inputStyle} />
          <select value={form.estadoCivil} onChange={(e) => set("estadoCivil", e.target.value)} style={inputStyle}>{ESTADOS_CIVILES.map((x) => <option key={x} value={x}>{x || "Estado civil"}</option>)}</select>
          <input value={form.padronNumero} onChange={(e) => { set("padronNumero", e.target.value); setValidationError(""); }} placeholder="N° de padrón" style={{ ...inputStyle, borderColor: duplicatedPadron ? "#fb923c" : C.border, background: duplicatedPadron ? "#fff7ed" : inputStyle.background }} />
          <select value={form.localidad} onChange={(e) => { set("localidad", e.target.value); set("barrioSeleccionado", ""); set("barrioManual", ""); }} style={inputStyle}>{LOCALIDADES.map((loc) => <option key={loc} value={loc}>{loc}</option>)}</select>
          <select value={form.barrioSeleccionado} onChange={(e) => set("barrioSeleccionado", e.target.value)} style={inputStyle}>
            <option value="">Barrio</option>
            {barrios.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {form.barrioSeleccionado === "Otro" ? <input value={form.barrioManual} onChange={(e) => set("barrioManual", e.target.value)} placeholder="Escribí el barrio" style={inputStyle} /> : null}
          <select value={form.estado} onChange={(e) => set("estado", e.target.value)} style={inputStyle}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <select value={form.area} onChange={(e) => set("area", e.target.value)} style={inputStyle}><option value="">Área</option>{AREAS.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <select value={form.resp} onChange={(e) => set("resp", e.target.value)} style={inputStyle}>{UBICACIONES.map((u) => <option key={u} value={u}>{u || "Ubicación"}</option>)}</select>
          <textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Notas internas" rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhost} disabled={saving}>Cancelar</button>
          <button onClick={guardar} style={{ ...btnPrimary, opacity: duplicatedPadron ? 0.55 : 1, cursor: duplicatedPadron ? "not-allowed" : "pointer" }} disabled={saving || !!duplicatedPadron}>{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function ExpedienteRow({ exp, rowIndex = 0, users, usersMap, onSaveField, onOpen, onUploadPlano, onDeletePlano, deletingPlanoId, uploadingPlano, savingField, canEdit, onDelete, planos = [], selected, onToggleSelect, existingExpedientes = [], onDuplicatePadron }) {
  const [draft, setDraft] = useState(exp);

  useEffect(() => {
    setDraft(exp);
  }, [exp]);

  const zona = splitBarrio(draft.barrio);
  const saving = savingField === String(draft.id);
  const barrios = BARRIOS[zona.localidad || "Banda del Río Salí"] || ALL_BARRIOS;
  const latestPlano = planos[0] || null;
  const rowBg = rowIndex % 2 === 0 ? "#ffffff" : "#edf2f7";
  const rowFieldBg = rowIndex % 2 === 0 ? "#ffffff" : "#e2e8f0";

  const updateField = (field, value) => {
    if (field === "padronNumero") {
      const duplicatedPadron = findDuplicatePadron(existingExpedientes, value, draft.id);
      if (duplicatedPadron) {
        onDuplicatePadron?.(value, duplicatedPadron);
        return;
      }
    }

    const next = { ...draft, [field]: value };
    setDraft(next);
    if (canEdit) onSaveField(draft.id, { [field]: value });
  };

  const updateZona = (part, value) => {
    const nextZona = { ...zona, [part]: value };
    if (part === "localidad" && !nextZona.barrio) nextZona.barrio = (BARRIOS[value] || [])[0] || "";
    updateField("barrio", composeBarrio(nextZona.localidad || "Banda del Río Salí", nextZona.barrio || ""));
  };

  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top", background: rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
      <td style={{ background: rowBg, padding: "8px 6px", width: 32 }}>
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(exp.id)} />
      </td>
      <td style={{ background: rowBg, padding: "8px 6px", width: 118 }}>
        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800 }}>{draft.num}</span>
        <div style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>{draft.origenCarga}</div>
        <div style={{ marginTop: 8 }}><CompletenessBadge expediente={draft} attachments={planos} /></div>
      </td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 220 }}><input value={draft.titular} disabled={!canEdit} onChange={(e) => updateField("titular", e.target.value)} style={{ ...compactInputStyle, background: rowFieldBg }} /></td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 100 }}><input value={draft.dni} disabled={!canEdit} onChange={(e) => updateField("dni", e.target.value)} style={{ ...compactInputStyle, background: rowFieldBg }} /></td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 118 }}><input value={draft.telefono || ""} disabled={!canEdit} onChange={(e) => updateField("telefono", e.target.value)} style={{ ...compactInputStyle, background: rowFieldBg }} /></td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 120 }}><select value={draft.estadoCivil} disabled={!canEdit} onChange={(e) => updateField("estadoCivil", e.target.value)} style={{ ...compactInputStyle, background: rowFieldBg }}>{ESTADOS_CIVILES.map((x) => <option key={x} value={x}>{x || "Seleccionar"}</option>)}</select></td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 190 }}>
        <select value={zona.localidad || "Banda del Río Salí"} disabled={!canEdit} onChange={(e) => updateZona("localidad", e.target.value)} style={{ ...compactInputStyle, background: rowFieldBg, marginBottom: 8 }}>{LOCALIDADES.map((loc) => <option key={loc} value={loc}>{loc}</option>)}</select>
        <select value={zona.barrio || ""} disabled={!canEdit} onChange={(e) => updateZona("barrio", e.target.value)} style={{ ...compactInputStyle, background: rowFieldBg }}>
          <option value="">Barrio</option>
          {barrios.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 98 }}><input value={draft.padronNumero} disabled={!canEdit} onChange={(e) => updateField("padronNumero", e.target.value)} style={{ ...compactInputStyle, background: rowFieldBg }} /></td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 145 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {canEdit ? (
            <label style={{ ...btnGhost, textAlign: "center", padding: "8px 10px", fontSize: 11, color: uploadingPlano ? C.dim : C.text, cursor: uploadingPlano ? "not-allowed" : "pointer" }}>
              {uploadingPlano ? "Subiendo..." : "Subir archivo"}
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                multiple
                style={{ display: "none" }}
                disabled={uploadingPlano}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) onUploadPlano(draft.id, files);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
          {latestPlano || draft.planoUrl ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onDeletePlano(draft.id, latestPlano || { id: `legacy-${draft.id}`, archivoPath: draft.planoPath, nombreOriginal: draft.planoPath || "Plano", publicUrl: draft.planoUrl })}
                    disabled={deletingPlanoId === String((latestPlano || { id: `legacy-${draft.id}` }).id)}
                    style={{
                      ...btnGhost,
                      padding: "6px 10px",
                      fontSize: 11,
                      color: C.red,
                      borderColor: "#fecaca",
                      cursor: deletingPlanoId === String((latestPlano || { id: `legacy-${draft.id}` }).id) ? "not-allowed" : "pointer",
                      opacity: deletingPlanoId === String((latestPlano || { id: `legacy-${draft.id}` }).id) ? 0.6 : 1,
                    }}
                  >
                    {deletingPlanoId === String((latestPlano || { id: `legacy-${draft.id}` }).id) ? "Eliminando..." : "Eliminar último"}
                  </button>
                ) : null}
              </div>
              <a href={(latestPlano?.publicUrl || draft.planoUrl)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.sky, fontWeight: 700, textDecoration: "none" }}>{isPreviewableAttachment(latestPlano?.nombreOriginal, latestPlano?.tipoMime) ? "Abrir último" : "Descargar último"}</a>
              <span style={{ fontSize: 11, color: C.dim }}>{planos.length > 1 ? `${planos.length} archivos` : (latestPlano?.nombreOriginal || "1 archivo")}</span>
            </>
          ) : <span style={{ fontSize: 11, color: C.dim }}>Sin archivo</span>}
        </div>
      </td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 112 }}><select value={draft.estado} disabled={!canEdit} onChange={(e) => updateField("estado", e.target.value)} style={{ ...getEstadoSelectStyle(draft.estado), boxShadow: rowIndex % 2 === 0 ? "none" : "inset 0 0 0 9999px rgba(255,255,255,0.10)" }}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 110 }}><select value={draft.area} disabled={!canEdit} onChange={(e) => updateField("area", e.target.value)} style={{ ...compactInputStyle, background: rowFieldBg }}>{AREAS.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}</select></td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 126 }}><select value={draft.resp} disabled={!canEdit} onChange={(e) => updateField("resp", e.target.value)} style={{ ...compactInputStyle, background: rowFieldBg }}>{UBICACIONES.map((u) => <option key={u} value={u}>{u || "Ubicación"}</option>)}</select></td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 210 }}><textarea value={draft.notas} disabled={!canEdit} onChange={(e) => updateField("notas", e.target.value)} rows={2} style={{ ...compactInputStyle, background: rowFieldBg, resize: "vertical", minHeight: 44 }} /></td>
      <td style={{ background: rowBg, padding: "6px 5px", width: 98 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <button onClick={() => onOpen(draft)} style={{ ...btnPrimary, padding: "6px 10px", fontSize: 11 }}>Ver</button>
          {canEdit ? <button onClick={() => onDelete(draft)} style={{ ...btnGhost, padding: "6px 10px", fontSize: 11, color: C.red, borderColor: "#fecaca" }}>Eliminar</button> : null}
        </div>
        {saving ? <div style={{ marginTop: 8, fontSize: 10, color: C.dim }}>Guardando…</div> : null}
      </td>
    </tr>
  );
}

export default function App() {
  const [data, setData] = useState([]);
  const [users, setUsers] = useState([]);
  const [planosByExpediente, setPlanosByExpediente] = useState({});
  const [certificados, setCertificados] = useState([]);
  const [archivosByCertificado, setArchivosByCertificado] = useState({});
  const [uploadingCertificadoId, setUploadingCertificadoId] = useState("");
  const [deletingCertificadoFileId, setDeletingCertificadoFileId] = useState("");
  const [observacionesByExpediente, setObservacionesByExpediente] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fArea, setFArea] = useState("");
  const [fBarrio, setFBarrio] = useState("");
  const [fPrioridad, setFPrioridad] = useState("");
  const [fCompletitud, setFCompletitud] = useState("");
  const [page, setPage] = useState(1);
  const [modalItem, setModalItem] = useState(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [supabasePaused, setSupabasePaused] = useState(false);
  const [rawRowCount, setRawRowCount] = useState(0);
  const [hiddenDuplicateCount, setHiddenDuplicateCount] = useState(0);

  const [selectedLoginUserId, setSelectedLoginUserId] = useState(LOGIN_USERS[0].id);
  const [activeUser, setActiveUser] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalMode, setPasswordModalMode] = useState("change");
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState("");
  const [accessSyncStatus, setAccessSyncStatus] = useState({ kind: "", text: "" });
  const [accessHistory, setAccessHistory] = useState([]);

  const [savingField, setSavingField] = useState("");
  const [uploadingPlanoId, setUploadingPlanoId] = useState("");
  const [deletingPlanoId, setDeletingPlanoId] = useState("");
  const [addingObservacionIntendente, setAddingObservacionIntendente] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 900);
  const saveTimersRef = useRef({});

  const [importFiles, setImportFiles] = useState([]);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [sortOrder, setSortOrder] = useState("recent");
  const [selectedExpedientes, setSelectedExpedientes] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [bulkResponsable, setBulkResponsable] = useState("");

  const fechaActual = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const usersMap = useMemo(() => buildUsersMap(users), [users]);
  const canEdit = Boolean(activeUser?.canEdit);
  const canManageCertificados = Boolean(activeUser?.id === "emmanuel-aguilar" || activeUser?.canEdit);
  const barrioFilterOptions = useMemo(() => buildBarrioFilterOptions(), []);

  const stats = useMemo(() => ({
    total: data.length,
    proceso: data.filter((e) => e.estado === "en_proceso").length,
    criticos: data.filter((e) => e.prio === "critica").length,
    atrasados: data.filter((e) => e.dias >= 14).length,
    completos: data.filter((e) => getExpedienteCompleteness(e, planosByExpediente[e.id] || []).level === "alto").length,
  }), [data, planosByExpediente]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACCESS_HISTORY_KEY);
      setAccessHistory(raw ? JSON.parse(raw) : []);
    } catch {
      setAccessHistory([]);
    }
  }, []);

  useEffect(() => {
    if (activeUser) loadInitialData();
  }, [activeUser]);

  useEffect(() => () => {
    Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportHeight(window.innerHeight || 900);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function applyExpedientePlanoUpdate(expedienteId, filePath, publicUrl) {
    if (!supabase || !expedienteId) return { data: null, error: null };

    const timestamp = new Date().toISOString();
    const payload = {
      plano_path: filePath || "",
      plano_url: publicUrl || "",
      ultima_actualizacion: timestamp,
      updated_at: timestamp,
    };

    return await supabase
      .from("expedientes")
      .update(payload)
      .eq("id", expedienteId)
      .select("*")
      .single();
  }

  async function refreshPlanosForExpediente(expedienteId) {
    const result = await fetchPlanosForExpediente(expedienteId);
    if (result.error) return { data: [], error: result.error };

    const planos = result.data || [];
    setPlanosByExpediente((prev) => ({
      ...prev,
      [expedienteId]: planos,
    }));

    return { data: planos, error: null };
  }


  async function loadInitialData(showRefresh = false) {
    if (!supabase) {
      setError("Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError("");

    const [usersResult, expedientesResult] = await Promise.all([
      supabase.from("usuarios").select("id, nombre, rol, email, created_at").order("nombre", { ascending: true }),
      fetchAllExpedientes(),
    ]);

    if (usersResult.error) {
      if (isSupabasePaused(usersResult.error)) { setSupabasePaused(true); setLoading(false); setRefreshing(false); return; }
      setError(`No se pudieron cargar los usuarios: ${usersResult.error.message}`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (expedientesResult.error) {
      if (isSupabasePaused(expedientesResult.error)) { setSupabasePaused(true); setLoading(false); setRefreshing(false); return; }
      setError(`No se pudieron cargar los expedientes: ${expedientesResult.error.message}`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setUsers(usersResult.data || []);

    const normalizedRows = (expedientesResult.data || []).map(normalizeExpediente);
    const dedupeResult = dedupeExpedientesForView(normalizedRows);

    const expedienteIds = (expedientesResult.data || []).map((row) => row.id).filter(Boolean);
    const planosResult = await fetchPlanosIndex(expedienteIds);
    if (!planosResult.error) {
      setPlanosByExpediente(planosResult.data || {});
    } else {
      setPlanosByExpediente({});
    }

    const certificadosResult = await fetchCertificados();
    if (certificadosResult.error) {
      setCertificados([]);
      setArchivosByCertificado({});
      setError(`No se pudieron cargar las constancias: ${certificadosResult.error.message}`);
    } else {
      const certificadosData = certificadosResult.data || [];
      setCertificados(certificadosData);

      const certificadosIds = certificadosData.map((cert) => cert.id).filter(Boolean);
      const certArchivosResult = await fetchCertificadoArchivosIndex(certificadosIds);

      if (certArchivosResult.error) {
        setArchivosByCertificado({});
        setNotice(`Las constancias se cargaron, pero no se pudieron cargar sus archivos: ${certArchivosResult.error.message}`);
      } else {
        setArchivosByCertificado(certArchivosResult.data || {});
      }
    }

    const observacionesResult = await fetchObservacionesIntendenteIndex(expedienteIds);
    if (!observacionesResult.error) {
      setObservacionesByExpediente(observacionesResult.data || {});
    }

    const mergedRows = dedupeResult.uniqueRows.map((row) => {
      const planos = (planosResult.data || {})[row.id] || [];
      const latestPlano = planos[0] || null;
      if (!latestPlano) return row;
      return {
        ...row,
        planoPath: latestPlano.archivoPath || row.planoPath || "",
        planoUrl: latestPlano.publicUrl || row.planoUrl || "",
      };
    });

    setRawRowCount(dedupeResult.totalRows);
    setHiddenDuplicateCount(dedupeResult.hiddenDuplicates);
    setData(mergedRows);
    setSelectedExpedientes((prev) => prev.filter((id) => mergedRows.some((row) => row.id === id)));

    if (dedupeResult.hiddenDuplicates > 0) {
      setNotice(`Se ocultaron ${dedupeResult.hiddenDuplicates} expedientes duplicados en pantalla. La base no fue modificada.`);
    }

    setLoading(false);
    setRefreshing(false);
  }

  async function handleLogin() {
    const selectedUser = LOGIN_USERS.find((u) => u.id === selectedLoginUserId);
    if (!selectedUser) {
      setLoginError("Seleccioná un usuario habilitado para ingresar.");
      return;
    }
    if (!supabase) {
      setLoginError("Faltan las variables de entorno de Supabase.");
      return;
    }

    const selectedNeedsPassword = Boolean(selectedUser?.requiresPassword);

    if (selectedNeedsPassword && !cleanText(loginPassword)) {
      setLoginError("Ingresá la contraseña para continuar.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");
    setAccessSyncStatus({ kind: "", text: "" });

    try {
      const usuarioClave = getLoginClaveById(selectedUser.id);

      if (selectedNeedsPassword) {
        const incomingHash = await hashPassword(loginPassword);
        const { data: panelUser, error: panelUserError } = await supabase
          .from("panel_usuarios")
          .select("id, nombre, usuario_clave, password_hash, password_set_at, rol, area")
          .eq("usuario_clave", usuarioClave)
          .maybeSingle();

        if (panelUserError) {
          throw new Error(panelUserError.message || "No se pudo validar el usuario.");
        }

        const cachedHashes = readPasswordHashCache();
        const cachedHash = cachedHashes[usuarioClave] || "";

        if (!panelUser) {
          const { data: createdPanelUser, error: createPanelUserError } = await supabase
            .from("panel_usuarios")
            .insert({
              nombre: selectedUser.nombre,
              usuario_clave: usuarioClave,
              password_hash: incomingHash,
              password_set_at: new Date().toISOString(),
              rol: selectedUser.rol,
              area: selectedUser.area,
              updated_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (createPanelUserError || !createdPanelUser) {
            throw new Error(createPanelUserError?.message || "No se pudo crear el usuario en panel_usuarios.");
          }

          writePasswordHashCache(usuarioClave, incomingHash);
        } else {
          const currentHash = panelUser.password_hash || cachedHash;

          if (!currentHash) {
            const { error: bootstrapPasswordError } = await supabase
              .from("panel_usuarios")
              .update({
                password_hash: incomingHash,
                password_set_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", panelUser.id);

            if (bootstrapPasswordError) {
              throw new Error(bootstrapPasswordError.message || "No se pudo registrar la contraseña inicial.");
            }
            writePasswordHashCache(usuarioClave, incomingHash);
          } else if (currentHash !== incomingHash) {
            throw new Error("Contraseña incorrecta.");
          } else if (!panelUser.password_hash && cachedHash === incomingHash) {
            const { error: syncPasswordError } = await supabase
              .from("panel_usuarios")
              .update({
                password_hash: incomingHash,
                password_set_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", panelUser.id);

            if (!syncPasswordError) writePasswordHashCache(usuarioClave, incomingHash);
          }
        }
      }

      const entry = { nombre: selectedUser.nombre, rol: selectedUser.rol, fecha_ingreso: new Date().toISOString() };
      const insertResult = await supabase.from("panel_accesos").insert(entry);
      const syncStatus = insertResult.error
        ? { kind: "warning", text: "Ingreso registrado localmente." }
        : { kind: "success", text: "Ingreso registrado correctamente." };

      const localEntry = { ...entry, tecnico: selectedUser.tecnico, area: selectedUser.area };
      let nextHistory = [];
      try {
        const raw = localStorage.getItem(ACCESS_HISTORY_KEY);
        const current = raw ? JSON.parse(raw) : [];
        nextHistory = [localEntry, ...current].slice(0, 10);
        localStorage.setItem(ACCESS_HISTORY_KEY, JSON.stringify(nextHistory));
      } catch {
        nextHistory = [localEntry];
      }

      setAccessHistory(nextHistory);
      setActiveUser({ ...selectedUser, lastLoginAt: entry.fecha_ingreso });
      setAccessSyncStatus(syncStatus);
      setLoginPassword("");
    } catch (err) {
      setLoginError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handlePasswordAction({ targetUserId, currentPassword, nextPassword }) {
    if (!supabase) {
      setPasswordModalError("Faltan las variables de entorno de Supabase.");
      return;
    }

    setPasswordModalLoading(true);
    setPasswordModalError("");

    try {
      const usuarioClave = getLoginClaveById(targetUserId);
      const targetUser = LOGIN_USERS.find((u) => u.id === targetUserId);

      if (!usuarioClave || !targetUser || !targetUser.requiresPassword) {
        throw new Error("Solo los usuarios con contraseña pueden usar esta función.");
      }

      const { data: panelUser, error: panelUserError } = await supabase
        .from("panel_usuarios")
        .select("id, password_hash")
        .eq("usuario_clave", usuarioClave)
        .maybeSingle();

      if (panelUserError) throw new Error(panelUserError.message || "No se pudo validar el usuario.");
      if (!panelUser) throw new Error("El usuario no existe en la tabla panel_usuarios.");

      if (passwordModalMode === "change") {
        const currentHash = await hashPassword(currentPassword);
        if (panelUser.password_hash && panelUser.password_hash !== currentHash) {
          throw new Error("La contraseña actual es incorrecta.");
        }
      }

      const nextHash = await hashPassword(nextPassword);
      const { error: updateError } = await supabase
        .from("panel_usuarios")
        .update({
          password_hash: nextHash,
          password_set_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", panelUser.id);

      if (updateError) throw new Error(updateError.message || "No se pudo guardar la contraseña.");

      setPasswordModalOpen(false);
      setNotice(passwordModalMode === "change" ? "Contraseña actualizada correctamente." : `Contraseña reseteada para ${targetUser.nombre}.`);
    } catch (err) {
      setPasswordModalError(err.message || "No se pudo actualizar la contraseña.");
    } finally {
      setPasswordModalLoading(false);
    }
  }

  async function addObservacionIntendente(expedienteId, observacion) {
    if (!supabase || !activeUser?.canAddExecutiveNotes || !expedienteId || !cleanText(observacion)) return false;
    setAddingObservacionIntendente(true);
    setError("");
    setNotice("");

    const payload = {
      expediente_id: expedienteId,
      autor_nombre: activeUser.nombre,
      autor_rol: activeUser.rol,
      observacion: cleanText(observacion),
    };

    const { data: inserted, error: insertError } = await supabase
      .from("observaciones_intendente")
      .insert(payload)
      .select("id, expediente_id, autor_nombre, autor_rol, observacion, created_at")
      .single();

    setAddingObservacionIntendente(false);

    if (insertError) {
      setError(`No se pudo guardar la observación del Intendente: ${insertError.message}`);
      return false;
    }

    const normalized = normalizeObservacionIntendente(inserted);
    setObservacionesByExpediente((prev) => ({
      ...prev,
      [expedienteId]: [normalized, ...(prev[expedienteId] || [])],
    }));
    setNotice("Observación del Intendente guardada correctamente.");
    return true;
  }


  async function createCertificado(payload) {
    if (!supabase || !canManageCertificados) return false;
    setSaving(true);
    setError("");
    setNotice("");

    const insertPayload = {
      numero: cleanText(payload.numero) || nextCertificadoNumber(certificados),
      vecino_nombre: normalizeTitular(payload.vecinoNombre),
      dni: cleanText(payload.dni),
      domicilio: cleanText(payload.domicilio),
      barrio: cleanText(payload.barrio),
      padron_catastral: cleanText(payload.padronCatastral),
      matricula_catastral: cleanText(payload.matriculaCatastral),
      propietario_legal: cleanText(payload.propietarioLegal),
      telefono: normalizePhone(payload.telefono),
      motivo: cleanText(payload.motivo) || "Constancia de tenencia precaria",
      presentado_ante: cleanText(payload.presentadoAnte),
      estado: cleanText(payload.estado) || "pendiente",
      fecha_visita: payload.fechaVisita || null,
      observaciones: cleanText(payload.observaciones),
      agente_nombre: cleanText(payload.agenteNombre) || activeUser?.nombre || "Emmanuel Aguilar",
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase
      .from(CERTIFICADOS_TABLE)
      .insert(insertPayload)
      .select("*")
      .single();

    setSaving(false);

    if (insertError) {
      setError(`No se pudo guardar la constancia: ${insertError.message}`);
      return false;
    }

    const normalized = normalizeCertificadoRecord(inserted);
    const reloadResult = await fetchCertificados();
    if (!reloadResult.error) {
      setCertificados(reloadResult.data || [normalized]);
    } else {
      setCertificados((prev) => [normalized, ...prev]);
    }
    setNotice("Constancia guardada correctamente.");
    return true;
  }

  async function saveCertificado(certificadoId, payload) {
    if (!supabase || !canManageCertificados || !certificadoId) return null;
    setSaving(true);
    setError("");
    setNotice("");

    const updatePayload = {
      numero: cleanText(payload.numero),
      vecino_nombre: normalizeTitular(payload.vecinoNombre),
      dni: cleanText(payload.dni),
      domicilio: cleanText(payload.domicilio),
      barrio: cleanText(payload.barrio),
      padron_catastral: cleanText(payload.padronCatastral),
      matricula_catastral: cleanText(payload.matriculaCatastral),
      propietario_legal: cleanText(payload.propietarioLegal),
      telefono: normalizePhone(payload.telefono),
      motivo: cleanText(payload.motivo) || "Constancia de tenencia precaria",
      presentado_ante: cleanText(payload.presentadoAnte),
      estado: cleanText(payload.estado) || "pendiente",
      fecha_visita: payload.fechaVisita || null,
      observaciones: cleanText(payload.observaciones),
      agente_nombre: cleanText(payload.agenteNombre) || activeUser?.nombre || "Emmanuel Aguilar",
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabase
      .from(CERTIFICADOS_TABLE)
      .update(updatePayload)
      .eq("id", certificadoId)
      .select("*")
      .single();

    setSaving(false);

    if (updateError) {
      setError(`No se pudo actualizar la constancia: ${updateError.message}`);
      return null;
    }

    const normalized = normalizeCertificadoRecord(updated);
    setCertificados((prev) => prev.map((cert) => cert.id === certificadoId ? normalized : cert));
    setNotice("Constancia actualizada correctamente.");
    return normalized;
  }


  async function deleteCertificado(certificadoId) {
    if (!supabase || !canManageCertificados || !certificadoId) return false;
    setSaving(true);
    setError("");
    setNotice("");

    const { error: deleteError } = await supabase
      .from(CERTIFICADOS_TABLE)
      .delete()
      .eq("id", certificadoId);

    setSaving(false);

    if (deleteError) {
      setError(`No se pudo eliminar la constancia: ${deleteError.message}`);
      return false;
    }

    setCertificados((prev) => prev.filter((cert) => cert.id !== certificadoId));
    setArchivosByCertificado((prev) => {
      const next = { ...prev };
      delete next[certificadoId];
      return next;
    });
    setNotice("Certificado eliminado correctamente.");
    return true;
  }

  async function deleteCertificadoFile(certificadoId, file) {
    if (!supabase || !canManageCertificados || !certificadoId || !file?.id) return false;
    setDeletingCertificadoFileId(String(file.id));
    setError("");
    setNotice("");

    try {
      if (file.archivoPath) {
        const { error: storageError } = await supabase.storage
          .from(CERTIFICADOS_BUCKET)
          .remove([file.archivoPath]);

        if (storageError) {
          throw new Error(`No se pudo eliminar el archivo del storage: ${storageError.message}`);
        }
      }

      const { error: deleteError } = await supabase
        .from(CERTIFICADOS_ARCHIVOS_TABLE)
        .delete()
        .eq("id", file.id);

      if (deleteError) {
        throw new Error(`No se pudo eliminar el registro del archivo: ${deleteError.message}`);
      }

      const refreshed = await fetchCertificadoArchivosIndex([certificadoId]);
      if (refreshed.error) throw new Error(refreshed.error.message);

      setArchivosByCertificado((prev) => ({
        ...prev,
        [certificadoId]: refreshed.data[certificadoId] || [],
      }));
      setNotice("Archivo eliminado correctamente.");
      return true;
    } catch (err) {
      setError(err.message || "No se pudo eliminar el archivo.");
      return false;
    } finally {
      setDeletingCertificadoFileId("");
    }
  }

  async function uploadCertificadoFiles(certificadoId, files) {
    if (!supabase || !canManageCertificados || !certificadoId || !files?.length) return;
    const invalidFile = files.find((file) => !isAllowedPlanoFile(file));
    if (invalidFile) {
      setError("Formato no permitido. Subí PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX o CSV.");
      return;
    }

    const oversized = files.find((file) => file.size > MAX_PLANO_FILE_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setError(`El archivo ${oversized.name} supera el límite de ${MAX_PLANO_FILE_SIZE_MB} MB.`);
      return;
    }

    setUploadingCertificadoId(String(certificadoId));
    setError("");
    setNotice("");

    try {
      for (const file of files) {
        const extension = getFileExtension(file.name) || "bin";
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const filePath = `${certificadoId}/${Date.now()}-${safeName || `archivo.${extension}`}`;

        const { error: uploadError } = await supabase.storage
          .from(CERTIFICADOS_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadError) {
          throw new Error(`No se pudo subir ${file.name}: ${uploadError.message}`);
        }

        const { error: insertError } = await supabase.from(CERTIFICADOS_ARCHIVOS_TABLE).insert({
          certificado_id: certificadoId,
          archivo_path: filePath,
          nombre_original: file.name,
          tipo_mime: file.type || null,
          tamano_bytes: Number(file.size || 0),
          uploaded_by: activeUser?.nombre || null,
          created_at: new Date().toISOString(),
        });

        if (insertError) {
          throw new Error(`El archivo se subió, pero no se pudo registrar: ${insertError.message}`);
        }
      }

      const refreshed = await fetchCertificadoArchivosIndex([certificadoId]);
      if (refreshed.error) throw new Error(refreshed.error.message);
      setArchivosByCertificado((prev) => ({ ...prev, [certificadoId]: refreshed.data[certificadoId] || [] }));
      setNotice("Archivo/documentación cargada correctamente.");
    } catch (err) {
      setError(err.message || "No se pudieron subir los archivos de la constancia.");
    } finally {
      setUploadingCertificadoId("");
    }
  }

  async function addExpediente(form) {
    if (!supabase || !canEdit) return;
    setSaving(true);
    setError("");
    setNotice("");

    const duplicatedPadron = findDuplicatePadron(data, form.padronNumero);
    if (duplicatedPadron) {
      setError(`No se creó el expediente: el padrón ${cleanText(form.padronNumero)} ya existe en ${duplicatedPadron.num || "otro expediente"} (${duplicatedPadron.titular || "sin titular"}).`);
      setSaving(false);
      return;
    }

    const payload = {
      numero_expediente: nextExpedienteNumber(data),
      titular: normalizeTitular(form.titular),
      dni: cleanText(form.dni),
      telefono: normalizePhone(form.telefono),
      barrio: composeBarrio(form.localidad, form.barrio),
      estado_civil: cleanText(form.estadoCivil),
      padron_numero: cleanText(form.padronNumero),
      plano_url: "",
      plano_path: "",
      estado: form.estado,
      area_actual: form.area,
      responsable_id: form.resp || null,
      documentacion: "incompleta",
      dias_sin_avance: 0,
      prioridad: "baja",
      observaciones: "",
      notas: form.notas || "",
      ultima_actualizacion: new Date().toISOString(),
      origen_carga: "manual",
      editable_tecnico: true,
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase.from("expedientes").insert(payload).select("*").single();
    if (insertError) {
      setError(`No se pudo guardar el expediente: ${insertError.message}`);
      setSaving(false);
      return;
    }

    setData((prev) => [normalizeExpediente(inserted), ...prev]);
    setNuevoOpen(false);
    setActiveNav("Expedientes");
    setNotice("Expediente creado correctamente.");
    setSaving(false);
  }

  async function persistFieldUpdate(expedienteId, partial) {
    if (!supabase || !canEdit) return;
    const payload = buildUpdatePayload(partial);
    setSavingField(String(expedienteId));
    const { data: updated, error: updateError } = await supabase
      .from("expedientes")
      .update(payload)
      .eq("id", expedienteId)
      .select("*")
      .single();

    if (updateError) {
      setError(`No se pudo guardar el expediente: ${updateError.message}`);
      setSavingField("");
      return;
    }

    const normalized = normalizeExpediente(updated);
    const latestPlano = (planosByExpediente[expedienteId] || [])[0] || null;
    const merged = latestPlano ? { ...normalized, planoPath: latestPlano.archivoPath || normalized.planoPath, planoUrl: latestPlano.publicUrl || normalized.planoUrl } : normalized;
    setData((prev) => prev.map((item) => (item.id === expedienteId ? merged : item)));
    setModalItem((prev) => (prev && prev.id === expedienteId ? merged : prev));
    setSavingField("");
  }

  function saveExpedienteField(expedienteId, partial) {
    if (!canEdit) return;

    if (Object.prototype.hasOwnProperty.call(partial, "padronNumero")) {
      const duplicatedPadron = findDuplicatePadron(data, partial.padronNumero, expedienteId);
      if (duplicatedPadron) {
        setError(`No se guardó el cambio: el padrón ${cleanText(partial.padronNumero)} ya existe en ${duplicatedPadron.num || "otro expediente"} (${duplicatedPadron.titular || "sin titular"}).`);
        return;
      }
    }

    setData((prev) => prev.map((item) => (item.id === expedienteId ? { ...item, ...partial } : item)));
    setModalItem((prev) => (prev && prev.id === expedienteId ? { ...prev, ...partial } : prev));

    const key = String(expedienteId);
    if (saveTimersRef.current[key]) clearTimeout(saveTimersRef.current[key]);
    saveTimersRef.current[key] = setTimeout(() => {
      persistFieldUpdate(expedienteId, partial);
      delete saveTimersRef.current[key];
    }, 700);
  }

  async function uploadPlanoFile(expedienteId, incomingFiles) {
    if (!supabase || !incomingFiles || !canEdit) return;

    const files = Array.isArray(incomingFiles) ? incomingFiles : [incomingFiles];
    if (!files.length) return;

    const invalidFile = files.find((file) => !isAllowedPlanoFile(file));
    if (invalidFile) {
      setError("Formato no permitido. Subí PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX o CSV.");
      return;
    }

    const oversized = files.find((file) => file.size > MAX_PLANO_FILE_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setError(`El archivo ${oversized.name} supera el límite de ${MAX_PLANO_FILE_SIZE_MB} MB.`);
      return;
    }

    setUploadingPlanoId(String(expedienteId));
    setError("");
    setNotice("");

    try {
      let lastFilePath = "";
      let lastPublicUrl = "";

      for (const file of files) {
        const extension = getFileExtension(file.name) || "bin";
        const safeBaseName = String(file.name || "archivo")
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 60) || "archivo";
        const filePath = `${expedienteId}/${Date.now()}-${safeBaseName}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(PLANOS_BUCKET)
          .upload(filePath, file, { upsert: false, contentType: file.type || undefined });

        if (uploadError) {
          throw new Error(`No se pudo subir ${file.name}: ${uploadError.message}`);
        }

        const publicUrl = buildPlanoPublicUrl(filePath);
        lastFilePath = filePath;
        lastPublicUrl = publicUrl;

        const metadataPayload = {
          expediente_id: expedienteId,
          archivo_path: filePath,
          nombre_original: file.name,
          tipo_mime: file.type || null,
          tamano_bytes: Number(file.size || 0),
          uploaded_by: activeUser?.nombre || null,
          created_at: new Date().toISOString(),
        };

        const { error: planoInsertError } = await supabase.from(PLANOS_TABLE).insert(metadataPayload);
        if (planoInsertError) {
          throw new Error(`El archivo se subió, pero no se pudo registrar en la base: ${planoInsertError.message}`);
        }
      }

      const { data: updatedExpediente, error: expedienteUpdateError } = await applyExpedientePlanoUpdate(expedienteId, lastFilePath, lastPublicUrl);
      if (expedienteUpdateError) {
        throw new Error(`El archivo se subió, pero no se pudo vincular al expediente: ${expedienteUpdateError.message}`);
      }

      const planosRefresh = await refreshPlanosForExpediente(expedienteId);
      if (planosRefresh.error) {
        throw new Error(`El archivo se subió, pero no se pudo refrescar la lista de planos: ${planosRefresh.error.message}`);
      }

      const normalizedExpediente = normalizeExpediente(updatedExpediente);
      const latestPlano = (planosRefresh.data || [])[0] || null;
      const mergedExpediente = latestPlano
        ? {
            ...normalizedExpediente,
            planoPath: latestPlano.archivoPath || normalizedExpediente.planoPath || lastFilePath,
            planoUrl: latestPlano.publicUrl || normalizedExpediente.planoUrl || lastPublicUrl,
          }
        : {
            ...normalizedExpediente,
            planoPath: normalizedExpediente.planoPath || lastFilePath,
            planoUrl: normalizedExpediente.planoUrl || lastPublicUrl,
          };

      setData((prev) => prev.map((item) => (item.id === expedienteId ? mergedExpediente : item)));
      setModalItem((prev) => (prev && prev.id === expedienteId ? mergedExpediente : prev));
      setNotice(files.length === 1 ? "Archivo subido correctamente." : `Se subieron ${files.length} archivos correctamente.`);
    } catch (err) {
      setError(err.message || "No se pudo subir el plano.");
    } finally {
      setUploadingPlanoId("");
    }
  }
  async function deletePlanoFile(expedienteId, plano) {
    if (!supabase || !canEdit || !expedienteId) return;

    const planoId = plano?.id;
    const isLegacyPlano = String(planoId || "").startsWith("legacy-");
    const ok = window.confirm(`¿Eliminar el plano "${plano?.nombreOriginal || "archivo"}"?`);
    if (!ok) return;

    setDeletingPlanoId(String(plano.id));
    setError("");
    setNotice("");

    try {
      if (plano.archivoPath) {
        const { error: storageError } = await supabase.storage
          .from(PLANOS_BUCKET)
          .remove([plano.archivoPath]);

        if (storageError) {
          throw new Error(`No se pudo eliminar el archivo del storage: ${storageError.message}`);
        }
      }

      if (!isLegacyPlano && planoId) {
        const { error: deletePlanoError } = await supabase
          .from(PLANOS_TABLE)
          .delete()
          .eq("id", planoId);

        if (deletePlanoError) {
          throw new Error(`No se pudo eliminar el registro del plano: ${deletePlanoError.message}`);
        }
      }

      const planosRefresh = await refreshPlanosForExpediente(expedienteId);
      if (planosRefresh.error) {
        throw new Error(`El plano se eliminó, pero no se pudo refrescar la lista: ${planosRefresh.error.message}`);
      }

      const latestPlano = (planosRefresh.data || [])[0] || null;
      const nextPath = latestPlano?.archivoPath || "";
      const nextUrl = latestPlano?.publicUrl || "";

      const { data: updatedExpediente, error: expedienteUpdateError } = await applyExpedientePlanoUpdate(expedienteId, nextPath, nextUrl);
      if (expedienteUpdateError) {
        throw new Error(`El plano se eliminó, pero no se pudo actualizar el expediente: ${expedienteUpdateError.message}`);
      }

      const normalizedExpediente = normalizeExpediente(updatedExpediente);
      const mergedExpediente = {
        ...normalizedExpediente,
        planoPath: nextPath,
        planoUrl: nextUrl,
      };

      setData((prev) => prev.map((item) => (item.id === expedienteId ? mergedExpediente : item)));
      setModalItem((prev) => (prev && prev.id === expedienteId ? mergedExpediente : prev));
      setNotice("Plano eliminado correctamente.");
    } catch (err) {
      setError(err.message || "No se pudo eliminar el plano.");
    } finally {
      setDeletingPlanoId("");
    }
  }

  async function deleteExpediente(item) {
    if (!supabase || !canEdit || !item?.id) return;
    const ok = window.confirm(`¿Eliminar el expediente ${item.num}? Esta acción no se puede deshacer.`);
    if (!ok) return;

    setError("");
    setNotice("");

    const planos = planosByExpediente[item.id] || [];
    if (planos.length) {
      const storagePaths = planos.map((plano) => plano.archivoPath).filter(Boolean);
      if (storagePaths.length) await supabase.storage.from(PLANOS_BUCKET).remove(storagePaths);
      await supabase.from(PLANOS_TABLE).delete().eq("expediente_id", item.id);
    }

    const { error: deleteError } = await supabase.from("expedientes").delete().eq("id", item.id);
    if (deleteError) {
      setError(`No se pudo eliminar el expediente: ${deleteError.message}`);
      return;
    }

    setPlanosByExpediente((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setSelectedExpedientes((prev) => prev.filter((id) => id !== item.id));
    setData((prev) => prev.filter((row) => row.id !== item.id));
    setModalItem((prev) => (prev?.id === item.id ? null : prev));
    setNotice(`Expediente ${item.num} eliminado correctamente.`);
  }

  function toggleSelectExpediente(expedienteId) {
    setSelectedExpedientes((prev) => prev.includes(expedienteId) ? prev.filter((id) => id !== expedienteId) : [...prev, expedienteId]);
  }

  function toggleSelectPage() {
    const pageIds = slice.map((item) => item.id);
    const allSelected = pageIds.every((id) => selectedExpedientes.includes(id));
    setSelectedExpedientes((prev) => allSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]);
  }


  async function applyBulkUpdate(partial, successLabel) {
    if (!supabase || !canEdit || !selectedExpedientes.length) {
      setError("Seleccioná al menos un expediente para aplicar cambios masivos.");
      return;
    }

    const payload = buildUpdatePayload(partial);
    const { error: updateError } = await supabase
      .from("expedientes")
      .update(payload)
      .in("id", selectedExpedientes);

    if (updateError) {
      setError(`No se pudo aplicar el cambio masivo: ${updateError.message}`);
      return;
    }

    setData((prev) => prev.map((item) => selectedExpedientes.includes(item.id) ? { ...item, ...partial, upd: payload.updated_at } : item));
    setModalItem((prev) => (prev && selectedExpedientes.includes(prev.id) ? { ...prev, ...partial, upd: payload.updated_at } : prev));
    setNotice(successLabel);
  }

  async function applyBulkEstado() {
    if (!bulkEstado) {
      setError("Seleccioná un estado para aplicar de forma masiva.");
      return;
    }
    await applyBulkUpdate({ estado: bulkEstado }, `Estado actualizado en ${selectedExpedientes.length} expediente(s).`);
  }

  async function applyBulkResponsable() {
    if (!bulkResponsable) {
      setError("Seleccioná un responsable para aplicar de forma masiva.");
      return;
    }
    await applyBulkUpdate({ resp: bulkResponsable }, `Responsable actualizado en ${selectedExpedientes.length} expediente(s).`);
  }

  async function exportSelectedToPdf() {
    const selectedRows = data.filter((item) => selectedExpedientes.includes(item.id));
    if (!selectedRows.length) {
      setError("Seleccioná al menos un expediente para descargar el PDF.");
      return;
    }

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const marginX = 42;
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
      let y = 46;

      const addWrappedLine = (label, value = "—") => {
        const text = `${label}: ${value || "—"}`;
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, marginX, y);
        y += lines.length * 14 + 4;
        if (y > pageHeight - 70) {
          doc.addPage();
          y = 46;
        }
      };

      selectedRows.forEach((expediente, index) => {
        if (index > 0) {
          doc.addPage();
          y = 46;
        }

        const attachments = planosByExpediente[expediente.id] || [];
        const completeness = getExpedienteCompleteness(expediente, attachments);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`Expediente ${expediente.num}`, marginX, y);
        y += 24;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        addWrappedLine("Titular", expediente.titular);
        addWrappedLine("DNI", expediente.dni);
        addWrappedLine("Contacto", expediente.telefono);
        addWrappedLine("Estado civil", expediente.estadoCivil);
        addWrappedLine("Barrio", expediente.barrio);
        addWrappedLine("Padrón", expediente.padronNumero);
        addWrappedLine("Estado", ESTADOS[expediente.estado]?.label || expediente.estado);
        addWrappedLine("Área", expediente.area);
        addWrappedLine("Ubicación", expediente.resp || "—");
        addWrappedLine("Completitud", `${completeness.label} (${completeness.percent}%)`);
        addWrappedLine("Notas", expediente.notas || expediente.observaciones || "—");
        addWrappedLine("Última actualización", formatDateTime(expediente.upd));
        addWrappedLine("Cantidad de archivos", String(attachments.length || 0));

        if (attachments.length) {
          attachments.forEach((attachment, idx) => {
            addWrappedLine(`Archivo ${idx + 1}`, `${attachment.nombreOriginal} • ${formatFileSize(attachment.tamanoBytes)} • ${attachment.publicUrl || "sin URL"}`);
          });
        }
      });

      doc.save(`expedientes-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      setError(`No se pudo generar el PDF. Verificá que el proyecto tenga instalada la librería jspdf. Detalle: ${err.message}`);
    }
  }


  async function importExcelNow() {
    if (!supabase || !canEdit) return;
    if (!importFiles.length) {
      setError("Seleccioná al menos un archivo Excel.");
      return;
    }

    setImportingExcel(true);
    setError("");
    setNotice("");
    setImportSummary(null);

    try {
      const { records, details } = await parseExcelFiles(importFiles);
      const filtered = records.filter((row) => row.titular || row.dni || row.padronNumero || row.telefono);

      if (!filtered.length) {
        setError("No se encontraron registros útiles para importar.");
        setImportingExcel(false);
        return;
      }

      const { data: existingRows, error: existingError } = await supabase
        .from("expedientes")
        .select("dni, titular, padron_numero");
      if (existingError) throw existingError;

      const existingPadronSet = new Set(
        (existingRows || []).map((row) => normalizePadron(row.padron_numero)).filter(Boolean)
      );
      const existingDniSet = new Set(
        (existingRows || []).map((row) => normalizeDni(row.dni)).filter(Boolean)
      );
      const existingFallbackSet = new Set(
        (existingRows || [])
          .filter((row) => !normalizeDni(row.dni))
          .map((row) => buildDuplicateKey({ titular: row.titular, padronNumero: row.padron_numero }))
          .filter(Boolean)
      );

      const seenBatchPadrones = new Set();
      const seenBatchDnis = new Set();
      const seenBatchFallbackKeys = new Set();
      const deduped = [];
      let ignoredDuplicates = 0;

      for (const row of filtered) {
        const padron = normalizePadron(row.padronNumero);
        const dni = normalizeDni(row.dni);
        const fallbackKey = !dni ? buildDuplicateKey(row) : "";

        if (padron) {
          if (existingPadronSet.has(padron) || seenBatchPadrones.has(padron)) {
            ignoredDuplicates += 1;
            continue;
          }
          seenBatchPadrones.add(padron);
        }

        if (dni) {
          if (existingDniSet.has(dni) || seenBatchDnis.has(dni)) {
            ignoredDuplicates += 1;
            continue;
          }
          seenBatchDnis.add(dni);
          deduped.push(row);
          continue;
        }

        if (fallbackKey) {
          if (existingFallbackSet.has(fallbackKey) || seenBatchFallbackKeys.has(fallbackKey)) {
            ignoredDuplicates += 1;
            continue;
          }
          seenBatchFallbackKeys.add(fallbackKey);
        }

        deduped.push(row);
      }

      if (!deduped.length) {
        setImportSummary({ totalFiles: importFiles.length, totalRows: 0, ignoredDuplicates, details });
        setImportFiles([]);
        setNotice(`No se cargaron expedientes nuevos. Se ignoraron ${ignoredDuplicates} repetidos por padrón, DNI o titular + padrón.`);
        setActiveNav("Expedientes");
        setImportingExcel(false);
        await loadInitialData(true);
        return;
      }

      const seed = data.reduce((max, item) => {
        const match = String(item.num || "").match(/EXP-\d{4}-(\d+)/i);
        return Math.max(max, Number(match?.[1] || 0));
      }, 0) + 1;

      const payload = deduped.map((row, index) => ({
        numero_expediente: nextExpedienteNumberFromSeed(seed, index),
        titular: normalizeTitular(row.titular),
        dni: cleanText(row.dni),
        telefono: normalizePhone(row.telefono),
        barrio: composeBarrio(row.localidad, row.barrio),
        estado_civil: cleanText(row.estadoCivil),
        padron_numero: cleanText(row.padronNumero),
        plano_url: "",
        plano_path: "",
        estado: "revision_inicial",
        area_actual: "Mesa de Entradas",
        responsable_id: null,
        documentacion: "incompleta",
        dias_sin_avance: 0,
        prioridad: "baja",
        observaciones: cleanText(row.observaciones),
        notas: row.notas || "",
        ultima_actualizacion: new Date().toISOString(),
        origen_carga: "excel",
        editable_tecnico: true,
        updated_at: new Date().toISOString(),
      }));

      const chunks = chunkArray(payload, 200);
      let insertedCount = 0;

      for (const chunk of chunks) {
        const { data: inserted, error: insertError } = await supabase.from("expedientes").insert(chunk).select("id");
        if (insertError) throw insertError;
        insertedCount += inserted?.length || 0;
      }

      await loadInitialData(true);
      setImportSummary({ totalFiles: importFiles.length, totalRows: insertedCount, ignoredDuplicates, details });
      setImportFiles([]);
      setNotice(`Importación completada. Se cargaron ${insertedCount} expedientes y se ignoraron ${ignoredDuplicates} repetidos por padrón, DNI o titular + padrón.`);
      setActiveNav("Expedientes");
    } catch (err) {
      setError(`No se pudo importar el Excel: ${err.message}`);
    }

    setImportingExcel(false);
  }

  const filtered = useMemo(() => {
    let d = [...data];
    const q = search.trim().toLowerCase();
    if (q) {
      d = d.filter((e) =>
        toSearchable(e.titular).includes(q) ||
        toSearchable(e.dni).includes(q) ||
        toSearchable(e.telefono).includes(q) ||
        toSearchable(e.num).includes(q) ||
        toSearchable(e.barrio).includes(q) ||
        toSearchable(e.resp || "").includes(q) ||
        toSearchable(e.notas).includes(q)
      );
    }
    if (fEstado) d = d.filter((e) => e.estado === fEstado);
    if (fArea) d = d.filter((e) => e.area === fArea);
    if (fPrioridad) d = d.filter((e) => e.prio === fPrioridad);
    if (fBarrio) d = d.filter((e) => e.barrio === fBarrio);
    if (fCompletitud) {
      d = d.filter((e) => {
        const info = getExpedienteCompleteness(e, planosByExpediente[e.id] || []);
        if (fCompletitud === "alto") return info.level === "alto";
        if (fCompletitud === "medio") return info.level === "medio";
        if (fCompletitud === "bajo") return info.level === "bajo";
        if (fCompletitud === "con_archivos") return (planosByExpediente[e.id] || []).length > 0 || Boolean(cleanText(e.planoUrl));
        if (fCompletitud === "sin_archivos") return (planosByExpediente[e.id] || []).length === 0 && !cleanText(e.planoUrl);
        return true;
      });
    }

    if (sortOrder === "az") d.sort((a, b) => cleanText(a.titular).localeCompare(cleanText(b.titular), "es", { sensitivity: "base" }));
    else if (sortOrder === "za") d.sort((a, b) => cleanText(b.titular).localeCompare(cleanText(a.titular), "es", { sensitivity: "base" }));
    else if (sortOrder === "complete") d.sort((a, b) => getExpedienteCompleteness(b, planosByExpediente[b.id] || []).percent - getExpedienteCompleteness(a, planosByExpediente[a.id] || []).percent);
    else d.sort((a, b) => new Date(b.upd || 0).getTime() - new Date(a.upd || 0).getTime());

    return d;
  }, [data, search, fEstado, fArea, fPrioridad, fBarrio, fCompletitud, usersMap, sortOrder, planosByExpediente]);

  const pageSize = useMemo(() => {
    const estimatedAvailable = viewportHeight - 320;
    const estimatedRows = Math.floor(estimatedAvailable / 78);
    return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, estimatedRows || MIN_PAGE_SIZE));
  }, [viewportHeight]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const slice = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const modalSequence = filtered;
  const modalIndex = modalItem ? modalSequence.findIndex((item) => item.id === modalItem.id) : -1;
  const modalTotal = modalSequence.length;

  function openNextExpediente() {
    if (modalIndex < 0 || modalIndex >= modalSequence.length - 1) return;
    setModalItem(modalSequence[modalIndex + 1]);
  }

  const pageButtons = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, "dots-end", totalPages];
    if (currentPage >= totalPages - 3) return [1, "dots-start", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "dots-start", currentPage - 1, currentPage, currentPage + 1, "dots-end", totalPages];
  }, [currentPage, totalPages]);

  const navItems = [
    { label: "Dashboard", icon: "⊞" },
    { label: "Expedientes", icon: "📋" },
    { label: "Constancias", icon: "📝" },
    ...(canEdit ? [{ label: "Importar Excel", icon: "⇪" }, { label: "Nuevo expediente", icon: "＋" }] : []),
  ];

  const accessSyncStyle = accessSyncStatus.kind === "success"
    ? { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }
    : accessSyncStatus.kind === "warning"
    ? { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }
    : null;

  if (!activeUser) {
    return <LoginScreen selectedUserId={selectedLoginUserId} onSelectUser={setSelectedLoginUserId} onIngresar={handleLogin} loginLoading={loginLoading} loginError={loginError} loginPassword={loginPassword} onPasswordChange={setLoginPassword} onOpenChangePassword={() => { setPasswordModalMode("change"); setPasswordModalError(""); setPasswordModalOpen(true); }} onOpenManualReset={() => { setPasswordModalMode("reset"); setPasswordModalError(""); setPasswordModalOpen(true); }} />;
  }

  return (
    <div style={{ margin: 0, fontFamily: "Segoe UI, sans-serif", background: C.bg, color: C.text, minHeight: "100vh", width: "100%", overflowX: "hidden" }}>
      <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
        <aside style={{ width: sidebarOpen ? 182 : 74, background: "#fff", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ padding: "18px 12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "center" }}>
            <div style={{ width: sidebarOpen ? 88 : 56, height: sidebarOpen ? 88 : 56, borderRadius: sidebarOpen ? 22 : 16, background: "#fff", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(15,23,42,.06)" }}>
              <img src="/logo-icono.png" alt="Municipio" style={{ width: sidebarOpen ? 68 : 40, height: sidebarOpen ? 68 : 40, objectFit: "contain" }} />
            </div>
          </div>
          <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {navItems.map((item) => {
              const active = activeNav === item.label;
              return (
                <button key={item.label} onClick={() => item.label === "Nuevo expediente" ? (canEdit ? setNuevoOpen(true) : null) : setActiveNav(item.label)} style={{ display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "flex-start" : "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "none", background: active ? "#eff6ff" : "transparent", cursor: "pointer", color: active ? "#2563eb" : C.muted, fontSize: 13 }}>
                  <span>{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
          <div style={{ padding: "8px 8px", borderTop: "1px solid #f1f5f9", fontSize: 11, color: C.dim, textAlign: sidebarOpen ? "left" : "center" }}>
            {sidebarOpen ? "Powered by NEXAIA" : "NX"}
          </div>
          <div style={{ padding: 8, borderTop: "1px solid #f1f5f9" }}>
            <button onClick={() => setSidebarOpen((s) => !s)} style={{ width: "100%", padding: 6, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#cbd5e1", fontSize: 11 }}>{sidebarOpen ? "◀" : "▶"}</button>
          </div>
        </aside>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, width: "100%", maxWidth: "none" }}>
          <header style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, padding: "12px clamp(14px, 1.8vw, 24px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", boxSizing: "border-box" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{activeNav}</div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Dirección de Regularización Dominial • </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div style={{ padding: "8px 12px", borderRadius: 999, border: `1px solid ${C.border}`, background: "#f8fafc", color: C.slate, fontSize: 13, fontWeight: 600 }}>{activeUser.nombre} · {activeUser.rol}</div>
              <button onClick={() => { setActiveUser(null); setSelectedLoginUserId(LOGIN_USERS[0].id); setActiveNav("Dashboard"); setLoginError(""); setLoginPassword(""); setNotice(""); setAccessSyncStatus({ kind: "", text: "" }); }} style={btnGhost}>Salir</button>
              <div style={{ fontSize: 13, color: C.muted }}>{fechaActual}</div>
              <button onClick={() => loadInitialData(true)} style={btnGhost}>{refreshing ? "Actualizando..." : "Actualizar"}</button>
              {activeUser?.canEdit ? <button onClick={() => { setPasswordModalMode("change"); setPasswordModalError(""); setPasswordModalOpen(true); }} style={btnGhost}>Cambiar contraseña</button> : null}
              {canEdit ? <button onClick={() => { setPasswordModalMode("reset"); setPasswordModalError(""); setPasswordModalOpen(true); }} style={btnGhost}>Reset manual admin</button> : null}
              {canEdit ? <button onClick={() => setNuevoOpen(true)} style={btnPrimary}>+ Nuevo expediente</button> : null}
            </div>
          </header>

          <main style={{ flex: 1, padding: "14px 14px 10px", width: "100%", maxWidth: "none", boxSizing: "border-box", overflowX: "hidden" }}>
            {supabasePaused ? (
              <div style={{ marginBottom: 16, background: "#fffbeb", border: "2px solid #f59e0b", borderRadius: 14, padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#92400e", marginBottom: 6 }}>El sistema está temporalmente inactivo</div>
                  <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6 }}>
                    La base de datos se pausó automáticamente por inactividad. Los datos están seguros, pero no se pueden guardar cambios hasta que el administrador reactive el sistema.
                  </div>
                </div>
              </div>
            ) : null}
            {error ? <div style={{ marginBottom: 16, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 14px", fontSize: 13 }}>{error}</div> : null}
            {!canEdit ? <div style={{ marginBottom: 16, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 14px", fontSize: 13 }}>Usuario en modo solo lectura. Este perfil no puede crear, editar, importar ni eliminar expedientes.</div> : null}

            {loading ? (
              <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.border}` }}><EmptyBlock title="Cargando datos del sistema" text="Esperando respuesta de Supabase para usuarios y expedientes." /></div>
            ) : activeNav === "Dashboard" ? (
              activeUser?.id === "gonzalo-monteros" ? (
                <IntendenteDashboard data={data} />
              ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  {[["Expedientes únicos", stats.total, "Mostrados en el panel"], ["Completos", stats.completos, "Con datos y adjuntos"], ["En proceso", stats.proceso, "Seguimiento activo"], ["Casos críticos", stats.criticos, "Prioridad crítica"], ["Atrasados (+14d)", stats.atrasados, "Requieren revisión"]].map(([label, value, note]) => (
                    <div key={label} style={{ background: "#fff", border: `1px solid ${C.border}`, padding: "14px 18px", borderRadius: 16 }}>
                      <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
                      <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>{note}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 14 }}>
                  <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>Ingreso actual</div>
                    <div style={{ marginTop: 12, fontSize: 18, fontWeight: 800 }}>{activeUser.nombre}</div>
                    <div style={{ marginTop: 4, color: C.muted }}>{activeUser.rol}</div>
                    <div style={{ marginTop: 16, fontSize: 12, color: C.dim }}>Último ingreso: {formatDateTime(activeUser.lastLoginAt)}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>Perfil técnico: {activeUser.tecnico ? "Sí" : "No"}</div>
                  </div>
                  <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>Últimos ingresos registrados</div>
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>{accessHistory.length === 0 ? <div style={{ color: C.dim, fontSize: 13 }}>Aún no hay accesos registrados.</div> : accessHistory.slice(0, 4).map((entry, index) => <div key={`${entry.nombre}-${entry.fecha_ingreso}-${index}`} style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}><div style={{ fontWeight: 700 }}>{entry.nombre}</div><div style={{ marginTop: 4, color: C.muted, fontSize: 13 }}>{entry.rol}</div><div style={{ marginTop: 6, color: C.dim, fontSize: 12 }}>{formatDateTime(entry.fecha_ingreso)}</div></div>)}</div>
                  </div>
                  <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>Importación masiva lista</div>
                    <div style={{ marginTop: 10, color: C.muted, fontSize: 13, lineHeight: 1.55 }}>Ya podés subir varios Excel desde el panel. El barrio se toma del nombre del archivo y la carga va directo a Supabase.</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
                      <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}><div style={{ fontWeight: 700, fontSize: 13, color: C.indigo }}>Campos nuevos</div><div style={{ marginTop: 10, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>estado_civil<br />telefono<br />padron_numero<br />plano_url<br />notas</div></div>
                      <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}><div style={{ fontWeight: 700, fontSize: 13, color: C.indigo }}>Cobertura actual</div><div style={{ marginTop: 10, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>Con plano: {data.filter((d) => (planosByExpediente[d.id] || []).length > 0 || cleanText(d.planoUrl)).length}<br />Con padrón: {data.filter((d) => cleanText(d.padronNumero)).length}<br />Con estado civil: {data.filter((d) => cleanText(d.estadoCivil)).length}<br />Usuarios cargados: {users.length}</div></div>
                    </div>
                  </div>
                </div>
              </>
              )
            ) : activeNav === "Constancias" ? (
              <CertificadosSection
                certificados={certificados}
                archivosByCertificado={archivosByCertificado}
                canManageCertificados={canManageCertificados}
                activeUser={activeUser}
                onCreate={createCertificado}
                onSave={saveCertificado}
                onDelete={deleteCertificado}
                onUploadFiles={uploadCertificadoFiles}
                onDeleteFile={deleteCertificadoFile}
                uploadingCertificadoId={uploadingCertificadoId}
                deletingCertificadoFileId={deletingCertificadoFileId}
              />
            ) : activeNav === "Importar Excel" ? (
              <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.border}`, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.slate }}>Importar archivos Excel</div>
                <div style={{ marginTop: 8, color: C.muted, fontSize: 13, lineHeight: 1.55 }}>Podés subir varios archivos .xlsx o .xls. El sistema toma el barrio desde el nombre del archivo y carga directo a Supabase. Los DNI repetidos se ignoran automáticamente.</div>
                <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                  <div style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: 20, background: "#f8fafc" }}>
                    <div style={{ fontWeight: 700, color: C.slate }}>Carga directa</div>
                    <div style={{ marginTop: 8, color: C.muted, fontSize: 13, lineHeight: 1.65 }}>1. Seleccionás varios Excel<br />2. El sistema detecta columnas útiles<br />3. Limpia datos<br />4. Inserta todo en Supabase sin vista previa</div>
                    <div style={{ marginTop: 18 }}><input type="file" accept=".xlsx,.xls" multiple disabled={!canEdit} style={inputStyle} onChange={(e) => setImportFiles(Array.from(e.target.files || []))} /></div>
                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button onClick={importExcelNow} style={btnPrimary} disabled={!canEdit || importingExcel || !importFiles.length}>{importingExcel ? "Importando..." : "Importar ahora"}</button>
                      <button onClick={() => setImportFiles([])} style={btnGhost} disabled={!canEdit || importingExcel}>Limpiar</button>
                    </div>
                    <div style={{ marginTop: 12, color: C.dim, fontSize: 12 }}>{importFiles.length ? `${importFiles.length} archivo(s) listos para importar.` : "Todavía no seleccionaste archivos."}</div>
                  </div>
                  <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                    <div style={{ fontWeight: 700, color: C.slate }}>Campos que detecta</div>
                    <div style={{ marginTop: 10, color: C.muted, fontSize: 13, lineHeight: 1.75 }}>• titular / nombre y apellido<br />• dni o dni/cuil<br />• estado civil<br />• padrón<br />• observaciones / entrega / estado</div>
                    <div style={{ marginTop: 14, fontWeight: 700, color: C.slate }}>Destino automático</div>
                    <div style={{ marginTop: 10, color: C.muted, fontSize: 13, lineHeight: 1.75 }}>• estado: Revisión inicial<br />• área: Mesa de Entradas<br />• origen_carga: excel<br />• barrio: nombre del archivo</div>
                  </div>
                </div>
                {importSummary ? (
                  <div style={{ marginTop: 18, background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                    <div style={{ fontWeight: 800, color: C.slate }}>Última importación</div>
                    <div style={{ marginTop: 8, color: C.muted, fontSize: 13 }}>Archivos: {importSummary.totalFiles} • Registros cargados: {importSummary.totalRows} • Repetidos ignorados: {importSummary.ignoredDuplicates || 0}</div>
                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>{importSummary.details.map((item) => <div key={item.fileName} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 8px", fontSize: 13 }}><strong>{item.fileName}</strong> — {item.count} registro(s) — {item.barrio}</div>)}</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", width: "100%", boxSizing: "border-box" }}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                      <div style={{ position: "relative", flex: 1, minWidth: 170 }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.dim, fontSize: 13 }}>🔍</span>
                        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar nombre, DNI, contacto, expediente, notas o ubicación..." style={{ ...inputStyle, paddingLeft: 32 }} />
                      </div>
                      <button onClick={() => { setSearch(""); setFEstado(""); setFArea(""); setFPrioridad(""); setFBarrio(""); setFCompletitud(""); setPage(1); }} style={btnGhost}>Limpiar filtros</button>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      <select value={fEstado} onChange={(e) => { setFEstado(e.target.value); setPage(1); }} style={{ ...inputStyle, width: "fit-content", minWidth: 180, flex: "0 1 190px" }}><option value="">Todos los estados</option>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                      <select value={fArea} onChange={(e) => { setFArea(e.target.value); setPage(1); }} style={{ ...inputStyle, width: "fit-content", minWidth: 180, flex: "0 1 190px" }}><option value="">Todas las áreas</option>{AREAS.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}</select>
                      <select value={fBarrio} onChange={(e) => { setFBarrio(e.target.value); setPage(1); }} style={{ ...inputStyle, width: "fit-content", minWidth: 210, flex: "0 1 260px" }}>
                        <option value="">Todos los barrios</option>
                        {barrioFilterOptions.map((group) => (
                          <optgroup key={group.localidad} label={group.localidad}>
                            {group.items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <select value={fPrioridad} onChange={(e) => { setFPrioridad(e.target.value); setPage(1); }} style={{ ...inputStyle, width: "fit-content", minWidth: 180, flex: "0 1 190px" }}><option value="">Todas las prioridades</option>{Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                      <select value={fCompletitud} onChange={(e) => { setFCompletitud(e.target.value); setPage(1); }} style={{ ...inputStyle, width: "fit-content", minWidth: 190, flex: "0 1 210px" }}>
                        <option value="">Toda completitud</option>
                        <option value="alto">Carga alta</option>
                        <option value="medio">Carga intermedia</option>
                        <option value="bajo">Carga baja</option>
                        <option value="con_archivos">Con archivos</option>
                        <option value="sin_archivos">Sin archivos</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 0, alignItems: "center" }}>
                      <button onClick={() => setSortOrder("recent")} style={{ ...btnGhost, background: sortOrder === "recent" ? "#eff6ff" : "#fff", color: sortOrder === "recent" ? "#2563eb" : C.muted, padding: "8px 12px" }}>Recientes</button>
                      <button onClick={() => setSortOrder("az")} style={{ ...btnGhost, background: sortOrder === "az" ? "#eff6ff" : "#fff", color: sortOrder === "az" ? "#2563eb" : C.muted, padding: "8px 12px" }}>Titular A-Z</button>
                      <button onClick={() => setSortOrder("za")} style={{ ...btnGhost, background: sortOrder === "za" ? "#eff6ff" : "#fff", color: sortOrder === "za" ? "#2563eb" : C.muted, padding: "8px 12px" }}>Titular Z-A</button>
                      <button onClick={() => setSortOrder("complete")} style={{ ...btnGhost, background: sortOrder === "complete" ? "#eff6ff" : "#fff", color: sortOrder === "complete" ? "#2563eb" : C.muted, padding: "8px 12px" }}>Más completos</button>
                      <button onClick={toggleSelectPage} style={{ ...btnGhost, padding: "8px 12px" }}>{slice.every((item) => selectedExpedientes.includes(item.id)) && slice.length ? "Deseleccionar página" : "Seleccionar página"}</button>
                      <button onClick={exportSelectedToPdf} style={{ ...btnPrimary, padding: "8px 12px" }}>Descargar PDF seleccionados</button>
                    </div>
                    {selectedExpedientes.length ? (
                      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 12, padding: 10 }}>
                        <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{selectedExpedientes.length} expediente(s) seleccionados</div>
                        <select value={bulkEstado} onChange={(e) => setBulkEstado(e.target.value)} style={{ ...compactInputStyle, width: 180 }}>
                          <option value="">Cambiar estado masivo</option>
                          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <button onClick={applyBulkEstado} style={{ ...btnGhost, padding: "8px 10px" }}>Aplicar estado</button>
                        <select value={bulkResponsable} onChange={(e) => setBulkResponsable(e.target.value)} style={{ ...compactInputStyle, width: 210 }}>
                          {UBICACIONES.map((u) => <option key={u} value={u}>{u || "Asignar ubicación masiva"}</option>)}
                        </select>
                        <button onClick={applyBulkResponsable} style={{ ...btnGhost, padding: "8px 10px" }}>Aplicar ubicación</button>
                      </div>
                    ) : null}
                  </div>

                  <div style={{ overflowX: "auto", overflowY: "visible", width: "100%" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1800, fontSize: 11, tableLayout: "fixed" }}>
                      <colgroup>
                        {TABLE_COLGROUP.map((col) => <col key={col.key} style={{ width: col.width }} />)}
                      </colgroup>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#fafafa", position: "sticky", top: 0, zIndex: 2 }}>
                          {EXPEDIENTES_TABLE_HEADERS.map((h) => <th key={h} style={{ padding: "7px 6px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: ".05em", background: "#fafafa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {slice.length === 0 ? <tr><td colSpan={EXPEDIENTES_TABLE_HEADERS.length}><EmptyBlock title="No se encontraron expedientes" text="Ajustá los filtros o cargá el primer expediente." /></td></tr> : slice.map((exp, rowIndex) => <ExpedienteRow key={exp.id} exp={exp} rowIndex={rowIndex} users={users} usersMap={usersMap} onSaveField={saveExpedienteField} onOpen={setModalItem} onUploadPlano={uploadPlanoFile} onDeletePlano={deletePlanoFile} deletingPlanoId={deletingPlanoId} uploadingPlano={uploadingPlanoId === String(exp.id)} savingField={savingField} canEdit={canEdit} onDelete={deleteExpediente} planos={planosByExpediente[exp.id] || []} selected={selectedExpedientes.includes(exp.id)} onToggleSelect={toggleSelectExpediente} existingExpedientes={data} onDuplicatePadron={(value, duplicated) => setError(`No se guardó el cambio: el padrón ${cleanText(value)} ya existe en ${duplicated.num || "otro expediente"} (${duplicated.titular || "sin titular"}).`)} />)}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ padding: "12px 18px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: C.muted }}>Mostrando {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} registros únicos • Seleccionados: {selectedExpedientes.length} • Filas totales en base: {rawRowCount} • Duplicados ocultos: {hiddenDuplicateCount} • Página {currentPage} de {totalPages}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button onClick={() => setPage(1)} style={btnGhost} disabled={currentPage === 1}>Primera</button>
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} style={btnGhost} disabled={currentPage === 1}>Anterior</button>
                      {pageButtons.map((item, index) => item === "dots-start" || item === "dots-end" ? (
                        <span key={`${item}-${index}`} style={{ padding: "0 4px", color: C.dim, fontSize: 12 }}>…</span>
                      ) : (
                        <button
                          key={`page-${item}`}
                          onClick={() => setPage(item)}
                          style={{
                            ...btnGhost,
                            minWidth: 40,
                            padding: "8px 10px",
                            background: currentPage === item ? "#eff6ff" : "#fff",
                            color: currentPage === item ? "#2563eb" : C.muted,
                            borderColor: currentPage === item ? "#93c5fd" : C.border,
                          }}
                        >
                          {item}
                        </button>
                      ))}
                      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={btnGhost} disabled={currentPage === totalPages}>Siguiente</button>
                      <button onClick={() => setPage(totalPages)} style={btnGhost} disabled={currentPage === totalPages}>Última</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <ModalExpediente item={modalItem} users={users} usersMap={usersMap} onClose={() => setModalItem(null)} onSaveField={saveExpedienteField} savingField={savingField} onUploadPlano={uploadPlanoFile} onDeletePlano={deletePlanoFile} uploadingPlano={uploadingPlanoId === String(modalItem?.id)} deletingPlanoId={deletingPlanoId} canEdit={canEdit} onDelete={deleteExpediente} planos={planosByExpediente[modalItem?.id] || []} onNext={modalIndex >= 0 && modalIndex < modalTotal - 1 ? openNextExpediente : null} modalIndex={modalIndex} modalTotal={modalTotal} activeUser={activeUser} observacionesIntendente={observacionesByExpediente[modalItem?.id] || []} onAddObservacionIntendente={addObservacionIntendente} addingObservacionIntendente={addingObservacionIntendente} existingExpedientes={data} onDuplicatePadron={(value, duplicated) => setError(`No se guardó el cambio: el padrón ${cleanText(value)} ya existe en ${duplicated.num || "otro expediente"} (${duplicated.titular || "sin titular"}).`)} />
      <PasswordAdminModal open={passwordModalOpen} mode={passwordModalMode} selectedUserId={passwordModalMode === "change" ? (activeUser?.id || selectedLoginUserId) : selectedLoginUserId} onClose={() => { setPasswordModalOpen(false); setPasswordModalError(""); }} onSubmit={handlePasswordAction} loading={passwordModalLoading} error={passwordModalError} />
      <NuevoExpedienteModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onSave={addExpediente} saving={saving} users={users} existingExpedientes={data} />
    </div>
  );
}
