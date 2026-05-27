import { HidDeivce } from "./WebHid";

/** 0x19 传图：只 OUT 不等 IN（设备仍会回显，由每包前清缓冲丢弃） */
const LCD_WRITE19_OUT_ONLY_NO_WAIT_IN = true;

export type LcdStreamWrite19Opts = {
  data: Uint8Array;
  baseAddress: number;
  islandMode: 0 | 1;
  onPacket?: (transferred: number, total: number) => void;
};

type CommandQueueArgs =
  | ['send' | 'get' | 'send_report', Array<number>]
  | ['bulk19', number[][]]
  | ['stream19', LcdStreamWrite19Opts]
  | (() => Promise<void>);

type CommandQueueEntry = {
  res: (val?: any) => void;
  rej: (error?: any) => void;
  args: CommandQueueArgs;
};
type CommandQueue = Array<CommandQueueEntry>;
const cache: { [addr: string]: { hid: any } } = {};
const globalCommandQueue: {
  [address: string]: { isFlushing: boolean; commandQueue: CommandQueue };
} = {};

export const shiftTo16Bit = ([lo, hi]: [number, number]): number =>
  (hi << 8) | lo;

export const shiftFrom16Bit = (value: number): [number, number] => [
  value & 255,
  value >> 8
];
const initAndConnectDevice = (address: string) => {
  return new HidDeivce(address);
};

export class LCDScreenAPI {
  address: string;
  test: boolean = false;
  constructor(address: string) {
    this.address = address;
    if (address == "demo") {
      this.test = true;
      cache[address] = {hid: new HidDeivce(address)}
    } else {
    if (!cache[address]) {
      const device = initAndConnectDevice(address);
      cache[address] = { hid: device };
    }}
  }

  getProductId() {
    return this.getHID().productId;
  }

  getConnectMode() {
    return (this.getProductId() == 0x062E) ? 'USB': '2.4G';
  }

  refresh(address: string) {
    this.address = address;
    cache[address] = { hid: initAndConnectDevice(address) };
  }

  get commandQueueWrapper() {
    if (!globalCommandQueue[this.address]) {
      globalCommandQueue[this.address] = {
        isFlushing: false,
        commandQueue: [],
      };
      return globalCommandQueue[this.address];
    }
    return globalCommandQueue[this.address];
  }

  async timeout(time: number) {
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: () =>
          new Promise((r) =>
            setTimeout(() => {
              r();
              res(undefined);
            }, time)
          ),
      });
      if (!this.commandQueueWrapper.isFlushing) {
        this.flushQueue();
      }
    });
  }

  async getDeviceData(
    bytes: Array<number> = []
  ): Promise<number[]> {
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: ['get', bytes],
      });
      if (!this.commandQueueWrapper.isFlushing) {
        this.flushQueue();
      }
    });
  }

  async sendDeviceData(
    bytes: Array<number> = []
  ): Promise<number[]> {
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: ['get', bytes],
      });
      if (!this.commandQueueWrapper.isFlushing) {
        this.flushQueue();
      }
    });
  }

  /** 0x19 批量写 FLASH：只 OUT，单队列项内连发多包 */
  async sendBulkWrite19Packets(packets: number[][]): Promise<void> {
    if (!packets.length) return;
    if (this.test) return;
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: ['bulk19', packets],
      });
      if (!this.commandQueueWrapper.isFlushing) {
        this.flushQueue();
      }
    });
  }

  /** 0x19 整段传图：单队列项、一次 HID 锁、复用缓冲（最快路径） */
  async streamWrite19Payload(opts: LcdStreamWrite19Opts): Promise<void> {
    if (!opts.data.length) return;
    if (this.test) return;
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: ['stream19', opts],
      });
      if (!this.commandQueueWrapper.isFlushing) {
        this.flushQueue();
      }
    });
  }
  
  async flushQueue() {
    if (this.commandQueueWrapper.isFlushing === true) {
      return;
    }
    this.commandQueueWrapper.isFlushing = true;
    while (this.commandQueueWrapper.commandQueue.length !== 0) {
      const { res, rej, args } =
        this.commandQueueWrapper.commandQueue.shift() as CommandQueueEntry;
      // This allows us to queue promises in between hid commands, useful for timeouts
      if (typeof args === "function") {
        await args();
        res();
      } else if (args[0] == 'send_report') {
        try {
          const [type, ...dataArgs] = args;
          const ans = await this.webhid_send_report(...dataArgs);
          res(ans)
        } catch (error) {
         rej(error) 
        }

      } else if (args[0] === 'bulk19') {
        try {
          await this.webhid_write19_burst(args[1]);
          res(undefined);
        } catch (e: any) {
          rej(e);
        }

      } else if (args[0] === 'stream19') {
        try {
          await this.webhid_stream_write19(args[1]);
          res(undefined);
        } catch (e: any) {
          rej(e);
        }

      } else {
        try {
          const [type, ...dataArgs] = args;
          
          const ans = await this.webhid_write_command(...dataArgs);
          res(ans);
          
        } catch (e: any) {
          rej(e);
        }
      }
    }
    this.commandQueueWrapper.isFlushing = false;
  }

  getHID() {
    return cache[this.address].hid;
  }

  /** 已连接屏幕的底层 HID，用于与 OTA 协议共用同一 handle（无需再选 0x1919） */
  getScreenHidDevice(): HIDDevice | undefined {
    if (this.test) return undefined;
    try {
      return this.getHID().getWebHidDevice();
    } catch {
      return undefined;
    }
  }

  /** 清空 WebHid 读缓冲，避免 OTA 成功后二次升级读到残留 IN */
  clearOtaStaleBuffers() {
    if (this.test) return;
    try {
      this.getHID().clearOtaStaleBuffers();
    } catch {
      /* */
    }
  }

  /**
   * 与 WebHID OTA 共用同一设备前/后调用：丢弃主连接指令队列里未执行的项、解除 isFlushing 粘死，并清 HidDeivce 读缓冲。
   * 须在「无并发 setData」场景调用（如升级流程里已 setDownLoad 禁止轮询）。
   */
  resetLcdStateForOta() {
    if (this.test) return;
    const w = globalCommandQueue[this.address];
    if (w) {
      // 无论是否正在 flush：队里「尚未开始执行」的项必须清掉，否则二次 OTA 会在传图中途被旧 setData 插队
      const pending = w.commandQueue.splice(0);
      for (const it of pending) {
        try {
          it.rej(new Error('LCD queue reset for OTA'));
        } catch {
          /* */
        }
      }
      // 仅当 flush 卡在 await HID、且没有刚被丢弃的排队项时，解除 isFlushing，避免队列永久占死
      if (w.isFlushing && w.commandQueue.length === 0 && pending.length === 0) {
        w.isFlushing = false;
      }
    }
    this.clearOtaStaleBuffers();
  }

  async webhid_read_command(sinceTime = 0, timeoutMs = 10000): Promise<Uint8Array> {
    return this.getHID().readPWithTimeout(sinceTime, timeoutMs);
  }
  // 通过WebHID发送数据到键盘
  private packLcd19OutPayload(bytes: number[]): { reportId: number; payload: Uint8Array } {
    const commandBytes = [...bytes];
    const paddedArray = new Array(Math.max(33, commandBytes.length)).fill(0);
    commandBytes.forEach((val, idx) => {
      paddedArray[idx] = val;
    });
    return {
      reportId: paddedArray[0] ?? 0,
      payload: new Uint8Array(paddedArray.slice(1)),
    };
  }

  async webhid_stream_write19(opts: LcdStreamWrite19Opts): Promise<void> {
    if (!LCD_WRITE19_OUT_ONLY_NO_WAIT_IN) {
      const step = 56;
      let addr = opts.baseAddress;
      for (let i = 0; i < opts.data.length; i += step) {
        const n = Math.min(step, opts.data.length - i);
        const buf = new Uint8Array(65);
        buf[1] = 0xaa;
        buf[2] = 0x19;
        buf[3] = addr & 0xff;
        buf[4] = (addr >> 8) & 0xff;
        buf[5] = (addr >> 16) & 0xff;
        buf[6] = n;
        buf[7] = opts.islandMode;
        buf.set(opts.data.subarray(i, i + n), 9);
        await this.webhid_write_command(Array.from(buf));
        addr += n;
      }
      opts.onPacket?.(opts.data.length, opts.data.length);
      return;
    }
    await this.getHID().writeLcd19PayloadFast(
      0,
      opts.data,
      opts.baseAddress,
      opts.islandMode,
      56,
      opts.onPacket,
      128,
    );
  }

  async webhid_write19_burst(packets: number[][]): Promise<void> {
    if (!LCD_WRITE19_OUT_ONLY_NO_WAIT_IN) {
      for (const bytes of packets) {
        await this.webhid_write_command(bytes);
      }
      return;
    }
    const hid = this.getHID();
    const payloads = packets.map((b) => this.packLcd19OutPayload(b).payload);
    const reportId = this.packLcd19OutPayload(packets[0]!).reportId;
    hid.beginBulkWrite19();
    try {
      await hid.writeReportsOutOnlyBurst(reportId, payloads);
    } finally {
      hid.endBulkWrite19();
    }
  }

  async webhid_write_command(
    bytes: Array<number> = []
  ): Promise<any> {
    const commandBytes = [...bytes];
    const isBulkWrite19 = commandBytes[1] === 0xaa && commandBytes[2] === 0x19;
    let buffer: number[];

    if (isBulkWrite19) {
      const { reportId, payload } = this.packLcd19OutPayload(commandBytes);
      if (LCD_WRITE19_OUT_ONLY_NO_WAIT_IN) {
        await this.getHID().writeReportOutOnly(reportId, payload);
        buffer = [...commandBytes];
      } else {
        buffer = Array.from(
          await this.getHID().writeReportAndWaitInput(reportId, payload, 3000),
        );
      }
    } else {
      const paddedArray = new Array(Math.max(33, commandBytes.length)).fill(0);
      commandBytes.forEach((val, idx) => {
        paddedArray[idx] = val;
      });
      const commandMark = Date.now();
      await this.getHID().hid_write(paddedArray);
      const readSince = Math.max(0, commandMark - 100);
      buffer = Array.from(await this.webhid_read_command(readSince, 10000));
      console.debug(
        `Command for ${this.address}`,
        commandBytes,
        "Correct Resp:",
        buffer
      );
    }
    return buffer;
  }


  // 发送HID命令
  async webhid_send_command(
    bytes: Array<number> = []
  ): Promise<any> {
    const commandBytes = [...bytes];
    const paddedArray = new Array(33).fill(0);
    commandBytes.forEach((val, idx) => {
      paddedArray[idx] = val;
    });

    await this.getHID().write(paddedArray);
    console.debug(
      `Command for ${this.address}`,
      commandBytes,
    );
    return 'success';
  }


  async webhid_send_report(
    bytes: Array<number> = []
  ): Promise<any> {
    const commandBytes = [...bytes];
    const paddedArray = new Array(33).fill(0);
    commandBytes.forEach((val, idx) => {
      paddedArray[idx] = val;
    });

    const res = await this.getHID().send(0x00, paddedArray);
    console.debug(
      `Command for ${this.address}`,
      commandBytes, res,
    );
    return res;
  }

  async sendReport(
    bytes: Array<number> = []
  ): Promise<number[]> {
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: ['send_report', bytes],
      });
      if (!this.commandQueueWrapper.isFlushing) {
        this.flushQueue();
      }
    });
  }
}
