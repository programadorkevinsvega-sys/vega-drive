import type { ReactNode } from "react";
import { FILE_ICON_PATHS } from "./file-icon-paths";

/** Iconos propios, rejilla de 24 px, trazo de 1.75 px. */
const PATHS = {
  ...FILE_ICON_PATHS,
  drive: (
    <>
      <path d="M4 14.5 6.3 6.8A2 2 0 0 1 8.2 5.5h7.6a2 2 0 0 1 1.9 1.3L20 14.5" />
      <path d="M4 14.5h16v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <path d="M7.5 16.8h.01" />
    </>
  ),
  folder: (
    <path d="M3 7.5a2 2 0 0 1 2-2h4l2 2.2h8a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  ),
  file: (
    <>
      <path d="M6.5 5A1.5 1.5 0 0 1 8 3.5h5.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M13.5 3.5V9H19" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V5" />
      <path d="M7.5 9.5 12 5l4.5 4.5" />
      <path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  star: (
    <path d="m12 4.2 2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.6-4.8 2.6.9-5.3-3.9-3.8 5.4-.8z" />
  ),
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="m7 7 .8 11.2A1.8 1.8 0 0 0 9.6 20h4.8a1.8 1.8 0 0 0 1.8-1.8L17 7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4.5 4.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </>
  ),
  moon: <path d="M19.5 14.2A7.8 7.8 0 0 1 9.8 4.5a7.8 7.8 0 1 0 9.7 9.7z" />,
  monitor: (
    <>
      <rect x="3.5" y="5" width="17" height="11" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  edit: (
    <>
      <path d="m4 16.5-.8 4.3 4.3-.8L19 7.5a2.1 2.1 0 0 0-3-3z" />
      <path d="m14.8 5.7 3.5 3.5" />
    </>
  ),
  undo: <path d="M9 14 4.5 9.5 9 5M5 9.5h8a6 6 0 0 1 0 12h-2" />,
  plus: <path d="M12 5v14M5 12h14" />,
  "chevron-right": <path d="m9.5 6 6 6-6 6" />,
  "chevron-down": <path d="m6 9.5 6 6 6-6" />,
  more: (
    <>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  grid: (
    <path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z" />
  ),
  list: (
    <>
      <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20" />
      <path d="M4 6.5h.01M4 12h.01M4 17.5h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.4 5.2 3.7 17a1.8 1.8 0 0 0 1.6 2.7h13.4a1.8 1.8 0 0 0 1.6-2.7L13.6 5.2a1.8 1.8 0 0 0-3.2 0z" />
      <path d="M12 10v3.5M12 16.5h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5H7A1.5 1.5 0 0 0 5.5 6v12A1.5 1.5 0 0 0 7 19.5h7" />
      <path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function iconPath(name: IconName): ReactNode {
  return PATHS[name];
}
