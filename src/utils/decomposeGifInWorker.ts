type DecomposeGifInWorkerInput = {
  dataUrl: string;
  targetWidth: number;
  targetHeight: number;
  rotate: number;
  frameLimit?: number;
  maxGifFrames: number;
  maxDataUrlBytes: number;
  maxDecodeBudgetBytes: number;
  maxSourceSide: number;
};

type WorkerResponseOk = {
  id: number;
  ok: true;
  fpsFromGif: number;
  frames: ArrayBuffer[];
};

type WorkerResponseErr = {
  id: number;
  ok: false;
  error: string;
};

type WorkerResponse = WorkerResponseOk | WorkerResponseErr;

let requestSeq = 0;
let workerSingleton: Worker | null = null;
const pending = new Map<
  number,
  {
    resolve: (value: WorkerResponseOk) => void;
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
  workerSingleton = new Worker(new URL("../workers/screenThemeGifDecode.worker.ts", import.meta.url), {
    type: "module",
  });

  workerSingleton.onmessage = (ev: MessageEvent<WorkerResponse>) => {
    const data = ev.data;
    if (!data || typeof data.id !== "number") return;
    const item = pending.get(data.id);
    if (!item) return;
    pending.delete(data.id);
    clearTimeout(item.timer);
    if (!data.ok) {
      item.reject(new Error(data.error || "GIF_WORKER_UNKNOWN_ERROR"));
      return;
    }
    item.resolve(data);
  };

  workerSingleton.onerror = () => {
    terminateWorker("GIF_WORKER_RUNTIME_ERROR");
  };
  return workerSingleton;
}

export async function decomposeGifDataUrlToPngFramesInWorker(
  input: DecomposeGifInWorkerInput,
): Promise<{ frames: Uint8Array[]; fpsFromGif: number }> {
  if (typeof Worker === "undefined") {
    throw new Error("GIF_WORKER_UNAVAILABLE");
  }
  const worker = getWorker();
  const reqId = ++requestSeq;

  const out = await new Promise<WorkerResponseOk>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(reqId);
      reject(new Error("GIF_WORKER_TIMEOUT"));
    }, 180000);

    pending.set(reqId, { resolve, reject, timer: timeout });
    worker.postMessage({
      id: reqId,
      type: "decompose",
      payload: input,
    });
  });

  return {
    fpsFromGif: out.fpsFromGif,
    frames: out.frames.map((ab) => new Uint8Array(ab)),
  };
}
