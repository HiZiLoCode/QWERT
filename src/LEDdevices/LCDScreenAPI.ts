import { HidDeivce } from "./WebHid";

type CommandQueueArgs = ['send' | 'get' | 'send_report', Array<number>] | (() => Promise<void>);
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

  async webhid_read_command(sinceTime = 0): Promise<Uint8Array> {
    return this.getHID().readP(sinceTime);
  }
  // 通过WebHID发送数据到键盘
  async webhid_write_command(
    bytes: Array<number> = []
  ): Promise<any> {
    const commandBytes = [...bytes];
    const paddedArray = new Array(33).fill(0);
    commandBytes.forEach((val, idx) => {
      paddedArray[idx] = val;
    });

    const commandTime = Date.now();
    try {
      await this.getHID().hid_write(paddedArray);
    } catch (error) {
        console.log(error)
    }

    // console.log("webhid_write_command", paddedArray);
    const buffer = Array.from(await this.webhid_read_command(commandTime));
    // console.log("webhid_read_command", buffer);
    
    console.debug(
      `Command for ${this.address}`,
      commandBytes,
      "Correct Resp:",
      buffer
    );
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
