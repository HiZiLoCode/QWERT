type CompressReq = {
  id: number;
  type: "compress";
  payload: {
    fps: number;
    frames: ArrayBuffer[];
  };
};

type CompressResOk = {
  id: number;
  ok: true;
  qgif: ArrayBuffer;
};

type CompressResErr = {
  id: number;
  ok: false;
  error: string;
};

type CompressRes = CompressResOk | CompressResErr;

let reqSeq = 0;
let workerSingleton: Worker | null = null;
const pending = new Map<
  number,
  {
    resolve: (value: Uint8Array) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

function terminateWorker(reason: string) {
  if (workerSingleton) {
    workerSingleton.terminate();
    workerSingleton = null;
  }
  for (const [id, p] of pending.entries()) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
    pending.delete(id);
  }
}

function getWorker(): Worker {
  if (workerSingleton) return workerSingleton;
  workerSingleton = new Worker(new URL("../workers/screenThemeQgifCompress.worker.ts", import.meta.url), {
    type: "module",
  });

  workerSingleton.onmessage = (ev: MessageEvent<CompressRes>) => {
    const data = ev.data;
    if (!data || typeof data.id !== "number") return;
    const item = pending.get(data.id);
    if (!item) return;
    pending.delete(data.id);
    clearTimeout(item.timer);
    if (!data.ok) {
      item.reject(new Error(data.error || "QGIF_WORKER_UNKNOWN_ERROR"));
      return;
    }
    item.resolve(new Uint8Array(data.qgif));
  };

  workerSingleton.onerror = () => {
    terminateWorker("QGIF_WORKER_RUNTIME_ERROR");
  };
  return workerSingleton;
}

export async function compressPngFramesToQgifInWorker(pngFrames: Uint8Array[], fps: number): Promise<Uint8Array> {
  if (typeof Worker === "undefined") {
    throw new Error("QGIF_WORKER_UNAVAILABLE");
  }
  const worker = getWorker();
  const id = ++reqSeq;

  const transferFrames = pngFrames.map((u8) =>
    u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength),
  );

  return new Promise<Uint8Array>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      terminateWorker("QGIF_WORKER_TIMEOUT");
      reject(new Error("QGIF_WORKER_TIMEOUT"));
    }, 240000);

    pending.set(id, { resolve, reject, timer });
    const req: CompressReq = {
      id,
      type: "compress",
      payload: {
        fps,
        frames: transferFrames,
      },
    };
    worker.postMessage(req, transferFrames);
  });
}
