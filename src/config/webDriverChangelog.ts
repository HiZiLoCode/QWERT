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
        version: '0.0.1',
        date: '2026-04-15',
        changes: {
            zh: ['新增设备:QK100 MKII'],
            en: ['Added device: QK100 MKII'],
        },
    },
    // 下次发布：在数组顶部新增一条，并同步 package.json 的 version：
    {
        version: '0.0.2',
        date: '2026-04-20',
        changes: {
            zh: [
                '1、统一消息提示样式为蓝底白字居中，并保留设备连接深色卡片样式',
                '2、保存至键盘前新增确认提示：下载过程中请勿断开USB端口，避免花屏',
                '3、优化拾音灯逻辑：动态/全灭禁用音频开关，静态下按开关控制方向显示',
                '4、完善国际化：侧边栏与键盘面板文案改为多语言，并补齐多语言词条',
            ],
            en: [
                '1、Unified toast style to blue background, white text, centered content, while keeping dark device-connection cards',
                '2、Added a pre-save confirmation before writing to keyboard: do not disconnect USB during download to avoid display corruption',
                '3、Refined pickup-light logic: disable audio switch in dynamic/all-off modes; in static mode, direction visibility follows the audio switch',
                '4、Improved i18n: moved Sidebar and KeyboardPanel labels to translations and added missing locale entries',
            ],
        },
    },
];
