/**
 * QMK / 点阵屏灯效名称配置
 * 参考 led-matrix-vue：按 deviceInfo.matrixLightLayout 加载 JSON
 */

export type MatrixLightEffect = {
  name: string;
  lang: string;
  value: number;
  brightness?: boolean;
  speed?: boolean;
  direction?: boolean;
  color?: boolean;
  palette?: boolean;
};

export type MatrixLightConfig = {
  LightMode: MatrixLightEffect[];
  /** 关闭点阵屏对应的 mode 值 */
  close: number;
  /** 自定义编辑模式对应的 mode 值 */
  custom: number;
  /** 0=默认行列映射; 1=上下翻转 */
  order?: number;
};

export type MatrixLightMeta = Pick<MatrixLightConfig, 'close' | 'custom' | 'order'>;

/** 按文件名（不含扩展名）加载点阵屏灯效配置；未找到时回退 LightMode.json */
export async function loadMatrixLightConfig(stem: string): Promise<MatrixLightConfig> {
  const normalized = stem.replace(/\.json$/i, '').trim();
  if (!normalized) {
    throw new Error('[matrixLight] 配置名为空');
  }

  let mod: { default?: MatrixLightConfig };
  try {
    mod = await import(`@/data/matrixLight/${normalized}.json`);
  } catch {
    mod = await import('@/data/matrixLight/LightMode.json');
  }

  const config = mod.default ?? (mod as unknown as MatrixLightConfig);
  if (!Array.isArray(config?.LightMode)) {
    throw new Error(`[matrixLight] 配置格式无效: ${normalized}`);
  }
  return config;
}

/** 将 JSON 转为 layout.lighting.matrixlight 条目 */
export function matrixLightConfigToEffects(config: MatrixLightConfig): MatrixLightEffect[] {
  return config.LightMode.map((item) => ({ ...item }));
}

export function matrixLightMetaFromConfig(config: MatrixLightConfig): MatrixLightMeta {
  return {
    close: config.close,
    custom: config.custom,
    order: config.order ?? 0,
  };
}
