export type PreviewKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "docx"
  | "xlsx"
  | "unsupported";

export function previewKind(name: string): PreviewKind {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp"].includes(extension)) {
    return "image";
  }
  if (["mp4", "webm", "ogv"].includes(extension)) return "video";
  if (["mp3", "wav", "ogg", "m4a"].includes(extension)) return "audio";
  if (extension === "pdf") return "pdf";
  if (["txt", "md", "markdown", "csv", "json", "log", "yaml", "yml"].includes(extension)) {
    return "text";
  }
  if (extension === "docx") return "docx";
  if (extension === "xlsx") return "xlsx";
  return "unsupported";
}

export function canPreviewFile(name: string): boolean {
  return previewKind(name) !== "unsupported";
}
