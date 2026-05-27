/**
 * 键盘固件版本更新记录（按设备区分，与 deviceInfo 的 key 规则一致）。
 *
 * 发布新固件说明时请：
 * 1. 找到对应设备的 key：`0x{VID}_0x{PID}_{keyboardID}`（与 src/config/deviceInfo.ts 中条目一致，第三段与 getDeviceUpgradeFile 使用的 keyboardID 相同）
 * 2. 在该设备数组中维护记录：**建议把最新可升级目标（与 upgradeVersion 一致）或最新已发布版本放在最前**，其余按新→旧排列
 * 3. changes 需填写 zh、en、zh-Hant、ja、ko、ru 六种语言
 *
 * version 字符串须与界面展示一致：
 * - 当前版本：设备 firmwareVer 转十六进制大写（无 0x），例如 104 → "68"
 * - 与 deviceInfo.upgradeVersion 一致时可用十进制字符串，例如 "102"
 */
import { deviceInfoKey } from '@/config/deviceInfo';

export type FirmwareChangelogLocale = 'zh' | 'en' | 'zh-Hant' | 'ja' | 'ko' | 'ru';

export type FirmwareReleaseChanges = Record<FirmwareChangelogLocale, string[]>;

export type FirmwareRelease = {
    version: string;
    date: string;
    changes: FirmwareReleaseChanges;
};

function resolveChangelogLocale(lang: string): FirmwareChangelogLocale | undefined {
    const l = lang.toLowerCase();
    if (l.startsWith('en')) return 'en';
    if (l === 'zh-hant' || l.startsWith('zh-hant')) return 'zh-Hant';
    if (l.startsWith('ja')) return 'ja';
    if (l.startsWith('ko')) return 'ko';
    if (l.startsWith('ru')) return 'ru';
    if (l.startsWith('zh')) return 'zh';
    return undefined;
}

/** 按当前界面语言选取固件更新说明，回退顺序：匹配语言 → zh → en */
export function pickFirmwareReleaseChanges(changes: FirmwareReleaseChanges, lang: string): string[] {
    const key = resolveChangelogLocale(lang);
    if (key && changes[key]?.length) return changes[key];
    if (changes.zh?.length) return changes.zh;
    if (changes.en?.length) return changes.en;
    return [];
}

/** 屏幕固件说明（与 FIRMWARE_CHANGELOG_BY_DEVICE 相同 key 规则） */
export const SCREEN_FIRMWARE_CHANGELOG_BY_DEVICE: Record<string, FirmwareRelease[]> = {
    '0x36B0_0x3059_0': [
        {
            version: '117',
            date: '2026-05-22',
            changes: {
                zh: ['1、游戏模式改为仅在游戏中不发码'],
                en: ['1、Game mode now suppresses key reports only while gaming'],
                'zh-Hant': ['1、遊戲模式改為只在遊戲中不發碼'],
                ja: ['1、ゲームモードはゲーム中のみキー送信を停止するよう変更'],
                ko: ['1、게임 모드는 게임 중에만 키 전송을 차단하도록 변경'],
                ru: ['1、Игровой режим теперь блокирует передачу клавиш только во время игры'],
            },
        },
        {
            version: '115',
            date: '2026-05-15',
            changes: {
                zh: ['1、修改简约灵动岛背景', '2、优化屏幕资源与预览一致性'],
                en: [
                    '1、Updated the minimalist Dynamic Island background',
                    '2、Improved consistency between screen resources and preview',
                ],
                'zh-Hant': ['1、修改簡約靈動島背景', '2、優化螢幕資源與預覽一致性'],
                ja: [
                    '1、ミニマルDynamic Islandの背景を更新',
                    '2、画面リソースとプレビューの一貫性を改善',
                ],
                ko: [
                    '1、미니멀 Dynamic Island 배경 수정',
                    '2、화면 리소스와 미리보기 일관성 개선',
                ],
                ru: [
                    '1、Обновлён фон минималистичного Dynamic Island',
                    '2、Улучшена согласованность ресурсов экрана и предпросмотра',
                ],
            },
        },
    ],
    default: [],
};

export function getScreenFirmwareReleasesForDevice(
    vendorId: number,
    productId: number,
    keySegment: number = 0
): FirmwareRelease[] {
    const k = deviceInfoKey(vendorId, productId, keySegment);
    const list = SCREEN_FIRMWARE_CHANGELOG_BY_DEVICE[k];
    if (list?.length) return list;
    return SCREEN_FIRMWARE_CHANGELOG_BY_DEVICE.default ?? [];
}

/** 设备 key → 该机型固件版本列表（含可选的「目标升级版本」说明，新在前） */
export const FIRMWARE_CHANGELOG_BY_DEVICE: Record<string, FirmwareRelease[]> = {
    '0x36B0_0x3059_0': [
        {
            version: '126',
            date: '2026-05-22',
            changes: {
                zh: ['1、修改一键打开驱动功能为 Fn+H'],
                en: ['1、Changed one-tap web driver access to Fn+H'],
                'zh-Hant': ['1、修改一鍵開啟驅動功能為 Fn+H'],
                ja: ['1、ワンタップWebドライバー起動を Fn+H に変更'],
                ko: ['1、원터치 웹 드라이버 실행을 Fn+H로 변경'],
                ru: ['1、Быстрый запуск веб-драйвера изменён на Fn+H'],
            },
        },
        {
            version: '125',
            date: '2026-05-22',
            changes: {
                zh: ['1、移除按键延迟设置功能键'],
                en: ['1、Removed the key delay toggle function key'],
                'zh-Hant': ['1、移除按鍵延遲設定功能鍵'],
                ja: ['1、キー遅延切替機能キーを削除'],
                ko: ['1、키 지연 전환 기능 키 제거'],
                ru: ['1、Удалена функциональная клавиша переключения задержки клавиш'],
            },
        },
        {
            version: '124',
            date: '2026-05-22',
            changes: {
                zh: [
                    '1、增加仅在有线模式下支持一键打开驱动功能',
                    '2、优化蓝牙模式下休眠唤醒',
                ],
                en: [
                    '1、Added one-tap web driver access in wired mode only',
                    '2、Improved sleep wake-up in Bluetooth mode',
                ],
                'zh-Hant': [
                    '1、新增僅在有線模式下支援一鍵開啟驅動功能',
                    '2、優化藍牙模式下休眠喚醒',
                ],
                ja: [
                    '1、有線モードのみでワンタップWebドライバー起動に対応',
                    '2、Bluetoothモードのスリープ復帰を最適化',
                ],
                ko: [
                    '1、유선 모드에서만 원터치 웹 드라이버 실행 지원 추가',
                    '2、Bluetooth 모드 절전 해제 개선',
                ],
                ru: [
                    '1、Добавлен быстрый запуск веб-драйвера только в проводном режиме',
                    '2、Улучшено пробуждение из сна в режиме Bluetooth',
                ],
            },
        },
        {
            version: '123',
            date: '2026-05-21',
            changes: {
                zh: [
                    '1、仅在有线模式下支持一键打开网页功能',
                    '2、修复键盘复位后，点阵屏熄灭问题',
                    '3、降低测试模式亮度',
                    '4、降低复位背光白色闪烁亮度',
                    '5、游戏模式改为只在游戏中不发码',
                ],
                en: [
                    '1、One-tap web page open is now supported in wired mode only',
                    '2、Fixed the matrix screen turning off after keyboard reset',
                    '3、Reduced brightness in test mode',
                    '4、Reduced brightness of white backlight flash on reset',
                    '5、Game mode now suppresses key reports only while gaming',
                ],
                'zh-Hant': [
                    '1、僅在有線模式下支援一鍵開啟網頁功能',
                    '2、修復鍵盤復位後，點陣螢幕熄滅問題',
                    '3、降低測試模式亮度',
                    '4、降低復位背光白色閃爍亮度',
                    '5、遊戲模式改為只在遊戲中不發碼',
                ],
                ja: [
                    '1、ワンタップでWebページを開く機能は有線モードのみで利用可能に',
                    '2、キーボードリセット後にドットマトリックス画面が消灯する問題を修正',
                    '3、テストモードの明るさを低減',
                    '4、リセット時のバックライト白色点滅の明るさを低減',
                    '5、ゲームモードはゲーム中のみキー送信を停止するよう変更',
                ],
                ko: [
                    '1、유선 모드에서만 원터치 웹 페이지 열기 지원',
                    '2、키보드 리셋 후 도트 매트릭스 화면이 꺼지는 문제 수정',
                    '3、테스트 모드 밝기 감소',
                    '4、리셋 시 백라이트 흰색 깜빡임 밝기 감소',
                    '5、게임 모드는 게임 중에만 키 전송을 차단하도록 변경',
                ],
                ru: [
                    '1、Быстрое открытие веб-страницы поддерживается только в проводном режиме',
                    '2、Исправлено отключение матричного экрана после сброса клавиатуры',
                    '3、Снижена яркость в тестовом режиме',
                    '4、Снижена яркость белой вспышки подсветки при сбросе',
                    '5、Игровой режим теперь блокирует передачу клавиш только во время игры',
                ],
            },
        },
        {
            version: '122',
            date: '2026-05-20',
            changes: {
                zh: ['1、修复二级休眠部分按键唤醒问题'],
                en: ['1、Fixed partial key wake-up failure after level-2 sleep'],
                'zh-Hant': ['1、修復二級休眠部分按鍵喚醒問題'],
                ja: ['1、レベル2スリープ復帰時に一部のキーが起動しない問題を修正'],
                ko: ['1、2단계 절전 해제 시 일부 키가 깨어나지 않는 문제 수정'],
                ru: ['1、Исправлена проблема пробуждения отдельных клавиш после сна уровня 2'],
            },
        },
        {
            version: '121',
            date: '2026-05-19',
            changes: {
                zh: ['1、修复一级休眠部分按键唤醒问题'],
                en: ['1、Fixed partial key wake-up failure after level-1 sleep'],
                'zh-Hant': ['1、修復一級休眠部分按鍵喚醒問題'],
                ja: ['1、レベル1スリープ復帰時に一部のキーが起動しない問題を修正'],
                ko: ['1、1단계 절전 해제 시 일부 키가 깨어나지 않는 문제 수정'],
                ru: ['1、Исправлена проблема пробуждения отдельных клавиш после сна уровня 1'],
            },
        },
        {
            version: '120',
            date: '2026-05-18',
            changes: {
                zh: ['1、添加一键进驱动功能', '2、修复蓝牙一级休眠唤醒会吞首键问题'],
                en: [
                    '1、Added one-tap web driver access',
                    '2、Fixed the first key being dropped after Bluetooth level-1 sleep wake-up',
                ],
                'zh-Hant': ['1、新增一鍵進驅動功能', '2、修復藍牙一級休眠喚醒會吞首鍵問題'],
                ja: [
                    '1、ワンタップでWebドライバーを開く機能を追加',
                    '2、Bluetoothレベル1スリープ復帰後に最初のキーが取りこぼされる問題を修正',
                ],
                ko: [
                    '1、원터치 웹 드라이버 진입 기능 추가',
                    '2、Bluetooth 1단계 절전 해제 후 첫 키가 누락되는 문제 수정',
                ],
                ru: [
                    '1、Добавлен быстрый переход в веб-драйвер',
                    '2、Исправлена потеря первой клавиши после пробуждения из Bluetooth-сна уровня 1',
                ],
            },
        },
        {
            version: '118',
            date: '2026-05-15',
            changes: {
                zh: ['1、优化部分灯光效果亮度', '2、修改简约灵动岛背景'],
                en: [
                    '1、Improved brightness for selected lighting effects',
                    '2、Updated the minimalist Dynamic Island background',
                ],
                'zh-Hant': ['1、優化部分燈光效果亮度', '2、修改簡約靈動島背景'],
                ja: [
                    '1、一部のライティング効果の明るさを最適化',
                    '2、ミニマルDynamic Islandの背景を更新',
                ],
                ko: [
                    '1、일부 조명 효과 밝기 최적화',
                    '2、미니멀 Dynamic Island 배경 수정',
                ],
                ru: [
                    '1、Улучшена яркость отдельных световых эффектов',
                    '2、Обновлён фон минималистичного Dynamic Island',
                ],
            },
        },
    ],
    default: [],
};

export function getFirmwareReleasesForDevice(
    vendorId: number,
    productId: number,
    keySegment: number = 0
): FirmwareRelease[] {
    const k = deviceInfoKey(vendorId, productId, keySegment);
    const list = FIRMWARE_CHANGELOG_BY_DEVICE[k];
    if (list?.length) return list;
    return FIRMWARE_CHANGELOG_BY_DEVICE.default ?? [];
}

export function findFirmwareRelease(
    releases: FirmwareRelease[],
    versionLabel: string | undefined
): FirmwareRelease | undefined {
    if (!versionLabel) return undefined;
    const t = versionLabel.trim().toUpperCase().replace(/^V/i, '');
    return releases.find((r) => r.version.toUpperCase() === t);
}
