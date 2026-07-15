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
        version: '1.0.5',
        date: '2026-07-10',
        changes: {
            zh: [
                '1、新增 Boot 模式恢复升级',
                // '2、新增设备：Neo Code 98、Neo Code 75、OWARIA80、Neo Code 75（QMK）、Neo Code 98（QMK）',
                '2、修复已知问题',
            ],
            en: [
                '1、Added Boot mode recovery upgrade',
                // '2、Added devices: Neo Code 98, Neo Code 75, OWARIA80, Neo Code 75 (QMK), Neo Code 98 (QMK)',
                '2、Fixed known issues',
            ],
            'zh-Hant': [
                '1、新增 Boot 模式恢復升級',
                // '2、新增裝置：Neo Code 98、Neo Code 75、OWARIA80、Neo Code 75（QMK）、Neo Code 98（QMK）',
                '2、修復已知問題',
            ],
            ja: [
                '1、Boot モード復旧アップグレードを追加',
                // '2、新規デバイス：Neo Code 98、Neo Code 75、OWARIA80、Neo Code 75（QMK）、Neo Code 98（QMK）',
                '2、既知の問題を修正',
            ],
            ko: [
                '1、Boot 모드 복구 업그레이드 추가',
                // '2、신규 기기: Neo Code 98, Neo Code 75, OWARIA80, Neo Code 75(QMK), Neo Code 98(QMK)',
                '2、알려진 문제 수정',
            ],
            ru: [
                '1、Добавлено восстановление обновления в режиме Boot',
                // '2、Добавлены устройства: Neo Code 98, Neo Code 75, OWARIA80, Neo Code 75 (QMK), Neo Code 98 (QMK)',
                '2、Исправлены известные проблемы',
            ],
        },
    },
    {
        version: '1.0.4',
        date: '2026-06-24',
        changes: {
            zh: ['支持主固件与屏幕固件降级刷入对应版本'],
            en: ['Support downgrading and flashing specific versions of main and screen firmware'],
            'zh-Hant': ['支援主固件與螢幕固件降級刷入對應版本'],
            ja: ['メイン／画面ファームウェアの指定バージョンへのダウングレード書き込みに対応'],
            ko: ['메인 및 화면 펌웨어 특정 버전으로 다운그레이드 플래시 지원'],
            ru: ['Поддержка отката и прошивки выбранных версий основной и экранной прошивки'],
        },
    },
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
