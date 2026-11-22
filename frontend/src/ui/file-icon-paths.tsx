import type { ReactNode } from "react";

export const FILE_ICON_PATHS = {
  "file-image": (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
      <circle cx="10" cy="12" r="1.2" />
      <path d="m8 17 3.2-3 2.1 1.8 1.7-1.5 2 2.7" />
    </>
  ),
  "file-video": (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
      <path d="m10 12 4.5 2.5-4.5 2.5z" />
    </>
  ),
  "file-audio": (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
      <path d="M9 14v2M11 12v6M13 13v4M15 11v8" />
    </>
  ),
  "file-pdf": (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
      <path d="M8.5 15h7M8.5 17h5" />
      <path d="M10 11.5v2h1a1 1 0 0 0 0-2z" />
    </>
  ),
  "file-word": (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
      <path d="m8.5 12 1.2 5 1.6-3.5 1.6 3.5 1.2-5" />
    </>
  ),
  "file-spreadsheet": (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
      <path d="M8.5 12h7M8.5 14.5h7M8.5 17h7M11 12v5M13.5 12v5" />
    </>
  ),
  "file-presentation": (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
      <rect x="8.5" y="11.5" width="7" height="4.5" rx=".5" />
      <path d="M12 16v2M10 18h4" />
    </>
  ),
  "file-archive": (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
      <path d="M11 10.5h2M11 12.5h2M11 14.5h2M11 16.5h2" />
    </>
  ),
  "file-code": (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
      <path d="m10.5 12-2 2 2 2M13.5 12l2 2-2 2" />
    </>
  ),
} satisfies Record<string, ReactNode>;
