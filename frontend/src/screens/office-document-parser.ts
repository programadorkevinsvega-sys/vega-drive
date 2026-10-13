const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;

async function unzipEntry(
  buffer: ArrayBuffer,
  wanted: string,
): Promise<Uint8Array> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let endOfCentralDirectory = -1;

  for (
    let offset = bytes.length - 22;
    offset >= Math.max(0, bytes.length - 65_557);
    offset--
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOfCentralDirectory = offset;
      break;
    }
  }

  if (endOfCentralDirectory < 0) {
    throw new Error("El documento no tiene una estructura ZIP válida.");
  }

  const entryCount = view.getUint16(endOfCentralDirectory + 10, true);
  if (entryCount > 10_000) {
    throw new Error("El documento contiene demasiadas entradas.");
  }

  let cursor = view.getUint32(endOfCentralDirectory + 16, true);
  for (let index = 0; index < entryCount; index++) {
    if (
      cursor + 46 > bytes.length ||
      view.getUint32(cursor, true) !== 0x02014b50
    ) {
      throw new Error("Índice ZIP inválido.");
    }

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(
      bytes.slice(cursor + 46, cursor + 46 + nameLength),
    );

    if (name === wanted) {
      if (
        compressedSize > MAX_PREVIEW_BYTES ||
        localOffset + 30 > bytes.length ||
        view.getUint32(localOffset, true) !== 0x04034b50
      ) {
        throw new Error("Entrada ZIP inválida o demasiado grande.");
      }

      const dataOffset =
        localOffset +
        30 +
        view.getUint16(localOffset + 26, true) +
        view.getUint16(localOffset + 28, true);
      if (dataOffset + compressedSize > bytes.length) {
        throw new Error("Entrada ZIP truncada.");
      }

      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      if (method === 0) return compressed;
      if (method !== 8 || typeof DecompressionStream === "undefined") {
        throw new Error("Compresión no compatible con este navegador.");
      }

      const raw = compressed.buffer.slice(
        compressed.byteOffset,
        compressed.byteOffset + compressed.byteLength,
      ) as ArrayBuffer;
      const reader = new Blob([raw])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"))
        .getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          totalBytes += part.value.byteLength;
          if (totalBytes > MAX_PREVIEW_BYTES) {
            await reader.cancel();
            throw new Error("El contenido descomprimido excede 25 MB.");
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }

      const result = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return result;
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(
    "El documento no contiene la sección necesaria para mostrarlo.",
  );
}

function parseXml(bytes: Uint8Array): XMLDocument {
  const xml = new DOMParser().parseFromString(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    "application/xml",
  );
  if (xml.querySelector("parsererror")) {
    throw new Error("El documento contiene XML inválido.");
  }
  return xml;
}

export async function readDocx(buffer: ArrayBuffer): Promise<string> {
  const xml = parseXml(await unzipEntry(buffer, "word/document.xml"));
  return Array.from(xml.getElementsByTagNameNS("*", "p"), (paragraph) =>
    Array.from(
      paragraph.getElementsByTagNameNS("*", "t"),
      (text) => text.textContent ?? "",
    ).join(""),
  )
    .filter(Boolean)
    .join("\n");
}

function columnIndex(reference: string): number {
  let index = 0;
  const letters = /^[A-Z]+/.exec(reference.toUpperCase())?.[0] ?? "A";
  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }
  return index - 1;
}

export async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  let sharedStrings: string[] = [];
  try {
    const sharedXml = parseXml(
      await unzipEntry(buffer, "xl/sharedStrings.xml"),
    );
    sharedStrings = Array.from(
      sharedXml.getElementsByTagNameNS("*", "si"),
      (item) =>
        Array.from(
          item.getElementsByTagNameNS("*", "t"),
          (text) => text.textContent ?? "",
        ).join(""),
    );
  } catch {
    sharedStrings = [];
  }

  const sheet = parseXml(await unzipEntry(buffer, "xl/worksheets/sheet1.xml"));
  return Array.from(sheet.getElementsByTagNameNS("*", "row"), (row) => {
    const cells: string[] = [];
    for (const cell of Array.from(row.getElementsByTagNameNS("*", "c"))) {
      const index = columnIndex(cell.getAttribute("r") ?? "A1");
      const value = cell.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
      cells[index] =
        cell.getAttribute("t") === "s"
          ? (sharedStrings[Number(value)] ?? "")
          : value;
    }
    return cells;
  }).slice(0, 500);
}

