/// <reference lib="webworker" />

type QgifModuleLike = {
  FS?: {
    readdir: (path: string) => string[];
    unlink: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
  };
  cwrap?: (name: string, ret: string, args: string[]) => (...params: number[] | string[]) => number;
  _getMemoryPages?: () => number;
  _extendMemory?: (pages: number) => void;
};

type CompressPayload = {
  fps: number;
  frames: ArrayBuffer[];
};

type WorkerReq = {
  id: number;
  type: "compress";
  payload: CompressPayload;
};

type WorkerOk = {
  id: number;
  ok: true;
  qgif: ArrayBuffer;
};

type WorkerErr = {
  id: number;
  ok: false;
  error: string;
};

type WorkerRes = WorkerOk | WorkerErr;

let qgifModulePromise: Promise<QgifModuleLike> | null = null;

async function loadCreateModuleFactory(): Promise<(arg?: Record<string, unknown>) => Promise<QgifModuleLike>> {
  const globalScope = self as unknown as {
    createModule?: (arg?: Record<string, unknown>) => Promise<QgifModuleLike>;
  };
  if (typeof globalScope.createModule === "function") {
    return globalScope.createModule;
  }

  const scriptResp = await fetch("/qgif.js", { cache: "no-store" });
  if (!scriptResp.ok) throw new Error("QGIF_MODULE_SCRIPT_NOT_FOUND");
  const script = await scriptResp.text();
  const installer = new Function(
    `${script}\nreturn (typeof createModule === "function" ? createModule : this.createModule);`,
  );
  const factory = installer.call(globalScope) as unknown;
  if (typeof factory !== "function") throw new Error("QGIF_MODULE_FACTORY_INVALID");
  globalScope.createModule = factory as (arg?: Record<string, unknown>) => Promise<QgifModuleLike>;
  return globalScope.createModule;
}

async function ensureQgifModule(): Promise<QgifModuleLike> {
  if (!qgifModulePromise) {
    qgifModulePromise = (async () => {
      const factory = await loadCreateModuleFactory();
      return factory({
        locateFile: (path: string) => {
          if (path.endsWith(".wasm")) return "/qgif.wasm";
          return `/${String(path).replace(/^\/+/, "")}`;
        },
      });
    })().catch((e) => {
      qgifModulePromise = null;
      throw e;
    });
  }
  return qgifModulePromise;
}

function tryExtendQgifWasmMemory(module: QgifModuleLike): void {
  try {
    const get = module._getMemoryPages;
    const ext = module._extendMemory;
    if (typeof get !== "function" || typeof ext !== "function") return;
    const currentPages = get();
    const targetPages = currentPages * 2;
    if (targetPages > currentPages) ext(targetPages);
  } catch {
    // ignore memory extension failures
  }
}

function cleanupQgifFs(module: QgifModuleLike): void {
  if (!module.FS) return;
  try {
    const files = module.FS.readdir("/");
    for (const file of files) {
      if (file === "." || file === "..") continue;
      try {
        module.FS.unlink(`/${file}`);
      } catch {
        // ignore unlink errors
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

async function compressQgif(payload: CompressPayload): Promise<ArrayBuffer> {
  const module = await ensureQgifModule();
  if (!module.FS || !module.cwrap) {
    throw new Error("QGIF_MODULE_NOT_READY");
  }

  cleanupQgifFs(module);
  tryExtendQgifWasmMemory(module);

  for (let i = 0; i < payload.frames.length; i++) {
    module.FS.writeFile(`/input_${i}.png`, new Uint8Array(payload.frames[i]));
  }

  const compressVideo = module.cwrap("compress_video_wasm", "number", ["string", "string", "number", "number"]);
  const type = 0;
  const fps = Math.max(1, Math.floor(payload.fps || 1));
  const attempts = [
    () => compressVideo("input_X.png", "output.qgif", type, fps),
    () => compressVideo("/input_X.png", "/output.qgif", type, fps),
  ];
  for (const run of attempts) {
    try {
      run();
      try {
        const out = module.FS.readFile("/output.qgif");
        if (out?.length) {
          return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
        }
      } catch {
        const out = module.FS.readFile("output.qgif");
        if (out?.length) {
          return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
        }
      }
    } catch {
      // try next path
    }
  }
  throw new Error("QGIF_COMPRESS_FAILED");
}

self.onmessage = async (ev: MessageEvent<WorkerReq>) => {
  const req = ev.data;
  if (!req || req.type !== "compress") return;
  try {
    const qgif = await compressQgif(req.payload);
    const res: WorkerRes = { id: req.id, ok: true, qgif };
    self.postMessage(res, [qgif]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "QGIF_WORKER_UNKNOWN_ERROR");
    const res: WorkerRes = { id: req.id, ok: false, error: message };
    self.postMessage(res);
  }
};
