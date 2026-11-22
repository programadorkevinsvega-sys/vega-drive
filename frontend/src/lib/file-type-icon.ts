import type { IconName } from "../ui/Icon";

export type FileVisualType =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "code"
  | "text"
  | "generic";

const EXTENSIONS: Record<FileVisualType, readonly string[]> = {
  image: [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "avif",
    "bmp",
    "svg",
    "tif",
    "tiff",
    "heic",
  ],
  video: ["mp4", "webm", "ogv", "mov", "mkv", "avi", "m4v"],
  audio: ["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma", "opus"],
  pdf: ["pdf"],
  document: ["doc", "docx", "odt", "rtf"],
  spreadsheet: ["xls", "xlsx", "ods", "csv", "tsv"],
  presentation: ["ppt", "pptx", "odp", "key"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"],
  code: [
    "js",
    "jsx",
    "ts",
    "tsx",
    "mjs",
    "cjs",
    "html",
    "htm",
    "css",
    "scss",
    "json",
    "xml",
    "yaml",
    "yml",
    "toml",
    "ini",
    "sh",
    "bash",
    "py",
    "java",
    "kt",
    "go",
    "rs",
    "c",
    "h",
    "cpp",
    "hpp",
    "cs",
    "php",
    "rb",
    "sql",
    "vue",
    "svelte",
    "graphql",
  ],
  text: ["txt", "log", "text", "md", "markdown"],
  generic: [],
};

const ICONS: Record<FileVisualType, IconName> = {
  image: "file-image",
  video: "file-video",
  audio: "file-audio",
  pdf: "file-pdf",
  document: "file-word",
  spreadsheet: "file-spreadsheet",
  presentation: "file-presentation",
  archive: "file-archive",
  code: "file-code",
  text: "file-text",
  generic: "file",
};

export function fileVisualType(name: string): FileVisualType {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  for (const [type, extensions] of Object.entries(EXTENSIONS) as [
    FileVisualType,
    readonly string[],
  ][]) {
    if (extensions.includes(extension)) return type;
  }
  return "generic";
}

export function fileTypeIcon(name: string): IconName {
  return ICONS[fileVisualType(name)];
}

export function fileTypeLabel(name: string): string {
  const labels: Record<FileVisualType, string> = {
    image: "Imagen",
    video: "Vídeo",
    audio: "Audio",
    pdf: "PDF",
    document: "Documento",
    spreadsheet: "Hoja de cálculo",
    presentation: "Presentación",
    archive: "Archivo comprimido",
    code: "Código",
    text: "Texto",
    generic: "Archivo",
  };
  return labels[fileVisualType(name)];
}
