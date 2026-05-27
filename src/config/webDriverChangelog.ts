/**
 * 网页驱动（本 Web 应用）版本更新记录。
 *
 * 发布新版本时请同步：
 * 1. 修改根目录 package.json 的 version
 * 2. 在本数组 **顶部** 追加一条记录（最新版本永远在最前）
 * 3. changes 需填写 zh、en、zh-Hant、ja、ko、ru 六种语言
 */
import type { FirmwareReleaseChanges } from '@/config/firmwareChangelog';

export type WebDriverRelease = {
    version: string;
    /** 发布日期，建议 YYYY-MM-DD */
    date: string;
    changes: FirmwareReleaseChanges;
};

export const WEB_DRIVER_RELEASES: WebDriverRelease[] = [
    {
        version: '1.0.3',
        date: '2026-05-22',
        changes: {
            zh: ['新增循环动画列表功能'],
            en: ['Added loop animation list feature'],
            'zh-Hant': ['新增循環動畫列表功能'],
            ja: ['ループアニメーション一覧機能を追加'],
            ko: ['루프 애니메이션 목록 기능 추가'],
            ru: ['Добавлен список циклических анимаций'],
        },
    },
    {
        version: '1.0.2',
        date: '2026-05-22',
        changes: {
            zh: ['修复已知问题'],
            en: ['Fixed known issues'],
            'zh-Hant': ['修復已知問題'],
            ja: ['既知の問題を修正'],
            ko: ['알려진 문제 수정'],
            ru: ['Исправлены известные проблемы'],
        },
    },
    {
        version: '1.0.1',
        date: '2026-05-15',
        changes: {
            zh: ['新增设备:QK100 Mk2'],
            en: ['Added device: QK100 Mk2'],
            'zh-Hant': ['新增裝置:QK100 Mk2'],
            ja: ['新規デバイス：QK100 Mk2'],
            ko: ['신규 기기: QK100 Mk2'],
            ru: ['Добавлено устройство: QK100 Mk2'],
        },
    },
];
