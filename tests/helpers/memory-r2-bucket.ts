interface MemoryObject {
  bytes: Uint8Array;
  contentType: string;
}

type FixedLengthStreamConstructor = new (length: number) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

function ensureFixedLengthStreamForNodeTests(): void {
  const runtime = globalThis as unknown as {
    FixedLengthStream?: FixedLengthStreamConstructor;
  };
  if (runtime.FixedLengthStream) return;

  class TestFixedLengthStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;

    constructor(expectedLength: number) {
      const transform = new TransformStream<Uint8Array, Uint8Array>();
      const writer = transform.writable.getWriter();
      let written = 0;
      this.readable = transform.readable;
      this.writable = new WritableStream<Uint8Array>({
        write(chunk) {
          if (written + chunk.byteLength > expectedLength) {
            const error = new RangeError("Stream exceeded its declared length");
            void writer.abort(error);
            throw error;
          }
          written += chunk.byteLength;
          return writer.write(chunk);
        },
        close() {
          if (written !== expectedLength) {
            const error = new RangeError(
              "Stream did not match its declared length",
            );
            return writer.abort(error).then(() => {
              throw error;
            });
          }
          return writer.close();
        },
        abort(reason) {
          return writer.abort(reason);
        },
      });
    }
  }

  Object.defineProperty(globalThis, "FixedLengthStream", {
    configurable: true,
    writable: true,
    value: TestFixedLengthStream,
  });
}

export function createMemoryR2Bucket(): R2Bucket {
  ensureFixedLengthStreamForNodeTests();
  const objects = new Map<string, MemoryObject>();
  const bucket = {
    async put(
      key: string,
      body: ReadableStream<Uint8Array>,
      options?: { httpMetadata?: { contentType?: string } },
    ) {
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        chunks.push(part.value);
        size += part.value.byteLength;
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      objects.set(key, {
        bytes,
        contentType:
          options?.httpMetadata?.contentType ?? "application/octet-stream",
      });
    },
    async head(key: string) {
      const object = objects.get(key);
      return object
        ? {
            size: object.bytes.byteLength,
            httpMetadata: { contentType: object.contentType },
          }
        : null;
    },
    async get(
      key: string,
      options?: { range?: { offset: number; length?: number } },
    ) {
      const object = objects.get(key);
      if (!object) return null;
      const bytes = options?.range
        ? object.bytes.slice(
            options.range.offset,
            options.range.offset +
              (options.range.length ?? object.bytes.length),
          )
        : object.bytes.slice();
      return {
        body: new Response(bytes).body,
        size: object.bytes.byteLength,
        httpMetadata: { contentType: object.contentType },
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
  return bucket as unknown as R2Bucket;
}
