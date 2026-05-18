/**
 * 网页驱动（本 Web 应用）版本更新记录。
 *
 * 发布新版本时请同步：
 * 1. 修改根目录 package.json 的 version
 * 2. 在本数组 **顶部** 追加一条记录（最新版本永远在最前）
 *
 * changes 中 zh / en 为各语言下的更新要点列表，会显示在「设置 → 固件 → 网页驱动」区域。
 */
export type WebDriverRelease = {
    version: string;
    /** 发布日期，建议 YYYY-MM-DD */
    date: string;
    changes: {
        zh: string[];
        en: string[];
    };
};

export const WEB_DRIVER_RELEASES: WebDriverRelease[] = [
    {
        version: '1.0.1',
        date: '2026-05-15',
        changes: {
            zh: ['新增设备:QK100 Mk2'],
            en: ['Added device: QK100 Mk2'],
        },
    },
];
