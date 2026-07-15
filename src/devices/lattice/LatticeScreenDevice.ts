/**
 * QMK 点阵屏 Raw HID 设备通信
 * 参考 led-matrix-vue LatticeScreenDevice
 */

import { getMatrixScreenConfig } from '@/config/deviceInfo';
import { LatticeScreenAPI } from './LatticeScreenAPI';

export class LatticeScreenComm {
  api: LatticeScreenAPI;
  vendorId: number = 0;
  productId: number = 0;
  productName: string = '';
  maxLightBrightness: number = 100;
  CMD2: number = 0x04;
  END: number = 0x03;

  constructor(api: LatticeScreenAPI) {
    this.api = api;
    const hid = this.api.getHID();
    this.vendorId = hid.vendorId;
    this.productId = hid.productId;
    this.productName = hid.productName;

    const cfg = getMatrixScreenConfig(this.vendorId, this.productId, 0);
    this.END = cfg?.latticeEnd ?? 0x03;
    this.CMD2 = cfg?.latticeCMD2 ?? 0x04;
  }

  async setData(data: number[]): Promise<number[]> {
    return this.api.sendDeviceData(data);
  }

  async sendEndCommand(): Promise<void> {
    const buffer: number[] = new Array(32).fill(0);
    buffer[1] = 0x09;
    buffer[2] = this.END;
    await this.setData(buffer);
  }

  async getDeviceInfo() {
    const buffer: number[] = new Array(33).fill(0);
    buffer[1] = 0x07;
    buffer[2] = this.CMD2;
    buffer[3] = 0x08;
    const data = await this.setData(buffer);
    this.maxLightBrightness = data[6] || 100;
    return {
      rows: data[3] || 7,
      cols: data[4] || 7,
      maxLightMode: data[5] || 0,
      maxLightBrightness: data[6] || 100,
      maxLightSpeed: data[7] || 4,
    };
  }

  async getLightBrightness() {
    const buffer: number[] = new Array(33).fill(0);
    buffer[1] = 0x08;
    buffer[2] = this.CMD2;
    buffer[3] = 0x01;
    const data = await this.setData(buffer);
    return { brightness: data[3] ?? 0 };
  }

  async getLightMode() {
    const buffer: number[] = new Array(33).fill(0);
    buffer[1] = 0x08;
    buffer[2] = this.CMD2;
    buffer[3] = 0x02;
    const data = await this.setData(buffer);
    return { lightMode: data[3] ?? 0 };
  }

  async getLightSpeed() {
    const buffer: number[] = new Array(33).fill(0);
    buffer[1] = 0x08;
    buffer[2] = this.CMD2;
    buffer[3] = 0x03;
    const data = await this.setData(buffer);
    return { speed: data[3] ?? 0 };
  }

  async setLightMode(mode: number) {
    const buffer: number[] = new Array(32).fill(0);
    buffer[1] = 0x07;
    buffer[2] = this.CMD2;
    buffer[3] = 0x02;
    buffer[4] = mode;
    await this.setData(buffer);
    await this.sendEndCommand();
  }

  async setLightSpeed(speed: number) {
    const buffer: number[] = new Array(32).fill(0);
    buffer[1] = 0x07;
    buffer[2] = this.CMD2;
    buffer[3] = 0x03;
    buffer[4] = speed;
    await this.setData(buffer);
    await this.sendEndCommand();
  }

  async setLightBrightness(percent: number) {
    const buffer: number[] = new Array(32).fill(0);
    buffer[1] = 0x07;
    buffer[2] = this.CMD2;
    buffer[3] = 0x01;
    buffer[4] = Math.round(percent * (this.maxLightBrightness / 100));
    await this.setData(buffer);
    await this.sendEndCommand();
  }

  async sendPixelData(index: number, r: number, g: number, b: number) {
    const buffer: number[] = new Array(32).fill(0);
    buffer[1] = 0x07;
    buffer[2] = this.CMD2;
    buffer[3] = 0x05;
    buffer[4] = index;
    buffer[5] = r;
    buffer[6] = g;
    buffer[7] = b;
    await this.setData(buffer);
    await this.sendEndCommand();
  }

  async sendFrameData(R: number, G: number, B: number, rows: number = 7, cols: number = 7) {
    const rgbData = new Uint8Array(rows * cols * 3).fill(0);
    for (let i = 0; i < rgbData.length; i += 3) {
      rgbData[i] = R;
      rgbData[i + 1] = G;
      rgbData[i + 2] = B;
    }

    const chunkSize = 27;
    for (let i = 0; i < rgbData.length; i += chunkSize) {
      const chunk = rgbData.slice(i, i + chunkSize);
      const buffer: number[] = new Array(32).fill(0);
      buffer[1] = 0x07;
      buffer[2] = this.CMD2;
      buffer[3] = 0x06;
      buffer[4] = i;
      buffer[5] = i + chunkSize;
      for (let j = 0; j < chunk.length; j++) {
        buffer[6 + j] = chunk[j];
      }
      await this.setData(buffer);
    }
    await this.sendEndCommand();
  }

  async readCustomLightColor(
    rows: number = 7,
    cols: number = 7,
  ): Promise<{ r: number; g: number; b: number }[]> {
    const totalPixels = rows * cols;
    const totalBytes = totalPixels * 3;
    const chunkSize = 27;
    const rgbData: number[] = [];

    for (let i = 0; i < totalBytes; i += chunkSize) {
      const buffer: number[] = new Array(32).fill(0);
      buffer[1] = 0x08;
      buffer[2] = this.CMD2;
      buffer[3] = 0x06;
      buffer[4] = i;
      buffer[5] = i + chunkSize;
      const result = await this.setData(buffer);
      const chunk = result.slice(5, 5 + chunkSize);
      rgbData.push(...chunk);
    }

    const rgbArray: { r: number; g: number; b: number }[] = [];
    for (let i = 0; i < rgbData.length; i += 3) {
      if (i + 2 >= rgbData.length) break;
      rgbArray.push({
        r: rgbData[i],
        g: rgbData[i + 1],
        b: rgbData[i + 2],
      });
    }
    await this.sendEndCommand();
    return rgbArray.slice(0, totalPixels);
  }

  async resetDevice() {
    const buffer: number[] = new Array(32).fill(0);
    buffer[1] = 0x07;
    buffer[2] = this.CMD2;
    buffer[3] = 0x07;
    await this.setData(buffer);
    await this.sendEndCommand();
  }
}

export function createLatticeScreenComm(hidAddress: string): LatticeScreenComm {
  return new LatticeScreenComm(new LatticeScreenAPI(hidAddress));
}
