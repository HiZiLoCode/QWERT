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
        version: '0.1.0',
        date: '2026-04-11',
        changes: {
            zh: [
                '设置页改版：区分「设置」与「固件」，卡片式布局',
                '支持网页驱动版本说明与历史版本查看',
                '扩展设备（如 0x3059）功能区协议与 NumLock 等选项',
            ],
            en: [
                'Settings UI: separate Settings vs Firmware tabs, card layout',
                'Web driver release notes and version history',
                'Extended function-area protocol for select devices (e.g. 0x3059), NumLock option',
            ],
        },
    },
    {
        version: '0.0.1',
        date: '2026-03-01',
        changes: {
            zh: ['初始网页驱动版本', 'Next.js + MUI 配置界面基础能力'],
            en: ['Initial web driver release', 'Next.js + MUI configuration baseline'],
        },
    },
    // 下次发布：在数组顶部新增一条，并同步 package.json 的 version：
    // {
    //   version: '0.2.0',
    //   date: '2026-05-01',
    //   changes: {
    //     zh: ['新功能说明一', '修复说明二'],
    //     en: ['Feature one', 'Fix two'],
    //   },
    // },
];
