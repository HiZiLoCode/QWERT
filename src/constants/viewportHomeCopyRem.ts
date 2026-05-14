/**
 * 视窗过小/溢出提示与首页主文案区统一字号（rem，相对 html 根字号）。
 * 层级：标题约 2.25× 正文；键帽略小于正文、等宽。
 */
export const VIEWPORT_HOME_COPY_REM = {
  title: '2.25rem',
  titleClamp: 'clamp(1.875rem, 4.5vw, 3rem)',
  body: '2rem',
  keycap: '0.875rem',
  stackGap: '1.25rem',
} as const;
