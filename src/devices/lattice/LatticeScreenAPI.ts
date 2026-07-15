/**
 * QMK 点阵屏 Raw HID 子协议（0x07/0x08/0x09）
 * 参考 led-matrix-vue LatticeScreenAPI
 */

import { HidDeivce } from '@/devices/WebHid';
import { withHidOutputWriteLock } from '@/lib/hidOutputWriteLock';

type CommandQueueArgs = ['write', Array<number>] | (() => Promise<void>);
type CommandQueueEntry = {
  res: (val?: unknown) => void;
  rej: (error?: unknown) => void;
  args: CommandQueueArgs;
};

const deviceCache: Record<string, { hid: HidDeivce }> = {};
const commandQueues: Record<
  string,
  { isFlushing: boolean; commandQueue: CommandQueueEntry[] }
> = {};

export class LatticeScreenAPI {
  address: string;

  constructor(address: string) {
    this.address = address;
    if (!deviceCache[address]) {
      deviceCache[address] = { hid: new HidDeivce(address) };
    }
  }

  get commandQueueWrapper() {
    if (!commandQueues[this.address]) {
      commandQueues[this.address] = { isFlushing: false, commandQueue: [] };
    }
    return commandQueues[this.address];
  }

  getHID(): HidDeivce {
    return deviceCache[this.address].hid;
  }

  async sendDeviceData(bytes: number[] = []): Promise<number[]> {
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: ['write', bytes],
      });
      if (!this.commandQueueWrapper.isFlushing) {
        void this.flushQueue();
      }
    });
  }

  async flushQueue(): Promise<void> {
    if (this.commandQueueWrapper.isFlushing) return;
    this.commandQueueWrapper.isFlushing = true;

    while (this.commandQueueWrapper.commandQueue.length !== 0) {
      const { res, rej, args } = this.commandQueueWrapper.commandQueue.shift() as CommandQueueEntry;
      if (typeof args === 'function') {
        try {
          await args();
          res();
        } catch (error) {
          rej(error);
        }
        continue;
      }

      try {
        const [, dataArgs] = args;
        const ans = await this.webhidWriteCommand(dataArgs);
        res(ans);
      } catch (error) {
        rej(error);
      }
    }

    this.commandQueueWrapper.isFlushing = false;
  }

  async webhidWriteCommand(bytes: number[] = []): Promise<number[]> {
    const paddedArray = new Array(33).fill(0);
    bytes.forEach((val, idx) => {
      paddedArray[idx] = val;
    });

    const hid = this.getHID();
    const webDevice = (hid as any)._hidDevice?._device as HIDDevice | undefined;
    if (webDevice) {
      await withHidOutputWriteLock(webDevice, async () => {
        await hid.write(paddedArray);
      });
    } else {
      await hid.write(paddedArray);
    }

    const buffer = Array.from(await hid.readP());
    return buffer;
  }
}
