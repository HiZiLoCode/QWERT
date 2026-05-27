'use client';

import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { EditorContext } from '@/providers/EditorProvider';
import { useContext, useState } from 'react';
import packageInfo from '../../package.json';
import { languages } from '@/app/i18n/setting';
import PublicAssetImage from '@/components/common/PublicAssetImage';

/** 与 ticktype0407CodeNew `configure/side/sidebar.tsx`、`common/menu.tsx`、`Lang.tsx` 对齐（本文件使用 px） */
const SIDE = {
    /** 与配置页截图一致：窄导航约 80px */
    width: 102,
    shadow: '2px 0 10px rgba(41, 75, 227, 0.1)',
    bg: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)',
    paddingYTop: 38,
    paddingYBottom: 60,
    columnGap: 10,
    menuContainerPaddingTop: 18,
    menuGap: 13,
    menuItemHeight: 80,
    menuIconSize: 28,
    menuItemInnerGap: 5,
    menuFontSize: 18,
    menuFontWeight: 400,
    bottomGap: 40,
    langSectionGap: 16,
    langBtnWidth: 91,
    langBtnHeight: 36,
    langBtnRadius: 36,
    langFontSize: 14,
    langFontWeight: 500,
    versionFontSize: 16,
    versionLineHeight: 20,
} as const;

/** 深色侧栏与设计稿一致（底 #1A1A1A、强调橙 #FF7F1A、白字） */
const DARK_SIDE = {
    bg: '#1a1a1a',
    orange: '#FF7F1A',
    text: '#FFFFFF',
    textSoft: 'rgba(255, 255, 255, 0.72)',
    hoverWash: 'rgba(255, 255, 255, 0.08)',
} as const;

type SidebarMenuId = 'keyboard' | 'test' | 'settings';

/** 来自 `图标.zip` →「机械轴驱动示例 (4)」资源包，已放入 `public/sidebar/` */
const SIDEBAR_MENU_ICON_SRC: Record<SidebarMenuId, string> = {
    keyboard: '/sidebar/menu-keyboard.svg',
    test: '/sidebar/menu-test.svg',
    settings: '/sidebar/menu-settings.svg',
};

export default function Sidebar() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const menuSelectedBg = theme.palette.primary.main;
    const menuColor = theme.palette.text.secondary;
    const menuHoverBg = alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1);
    /** 深色下菜单选中底、语言按钮等与稿一致 */
    const darkAccent = DARK_SIDE.orange;
    const menuSelBg = isDark ? darkAccent : menuSelectedBg;
    const menuIdleColor = isDark ? DARK_SIDE.text : menuColor;
    const menuIdleHoverBg = isDark ? DARK_SIDE.hoverWash : menuHoverBg;
    const { i18n, t } = useTranslation('common');
    const { onChangeTab, currentTab, setSelectedSetting } = useContext(EditorContext);
    const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
    const menuItems: { id: SidebarMenuId; label: string }[] = [
        { id: 'keyboard', label: t('2713') },
        { id: 'test', label: t('1300') },
        { id: 'settings', label: t('56') },
    ];

    const localeLabels: Record<string, string> = {
        zh: '中文',
        en: 'English',
        ja: '日本語',
        ru: 'Русский',
        ko: '한국어',
        'zh-Hant': '繁體中文',
    };

    const resolved = i18n.resolvedLanguage ?? i18n.language;
    const normalizedResolved =
        resolved.toLowerCase().startsWith('zh-hant')
            ? 'zh-Hant'
            : resolved.split('-')[0];
    const activeLanguage = languages.includes(normalizedResolved) ? normalizedResolved : languages[0];

    return (
        <Box
            sx={{
                height: '100%',
                width: `${SIDE.width}px`,
                position: 'relative',
                background: isDark ? DARK_SIDE.bg : SIDE.bg,
                boxShadow: isDark ? '2px 0 16px rgba(0,0,0,0.55)' : SIDE.shadow,
                flexShrink: 0,
            }}
        >
            {isDark ? (
                <Box
                    component="svg"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 100 1270"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden
                    sx={{
                        position: 'absolute',
                        pointerEvents: 'none',
                        width: '100%',
                        height: '100%',
                        inset: 0,
                    }}
                >
                    <rect x="0" y="0" width="100" height="1270" rx="0" ry="0" fill="var(--color-side-deco-base)" />
                    <path d="M100 394L0 497.5L0 752.5L100 856L100 394Z" fill="var(--color-side-deco-1)" />
                    <path d="M100 195L0 298.5L0 553.5L100 657L100 195Z" fill="var(--color-side-deco-1)" />
                    <path d="M0 0L100 0L100 253.135L0 355L0 0Z" fill="var(--color-side-deco-2)" />
                    <path d="M100 466L0 566.5L100 667L100 466Z" fill="var(--color-side-deco-2)" />
                    <path d="M100 856L0 957.5L0 1134.5L100 1033L100 856Z" fill="var(--color-side-deco-3)" />
                </Box>
            ) : null}
            {!isDark ? (
            <Box
                component="svg"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 100 1270"
                fill="none"
                preserveAspectRatio="none"
                sx={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    width: '100%',
                    height: '100%',
                    inset: 0,
                }}
            >
                <rect x="0" y="0" width="100" height="1270" fill="#F0F3F9" />
                <path d="M100 394L0 497.5L0 752.5L100 856L100 394Z" fill="#F7F8FC" />
                <path d="M100 195L0 298.5L0 553.5L100 657L100 195Z" fill="#F7F8FC" />
                <path d="M0 0L100 0L100 253.135L0 355L0 0Z" fill="#F2F3F9" />
                <path d="M100 466L0 566.5L100 667L100 466Z" fill="#F2F3F9" />
                <path d="M100 856L0 957.5L0 1134.5L100 1033L100 856Z" fill="#F7F7F7" />
            </Box>
            ) : null}

            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    padding: `${SIDE.paddingYTop}px 0 ${SIDE.paddingYBottom}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${SIDE.columnGap}px`,
                    position: 'relative',
                    boxSizing: 'border-box',
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                >
                    <PublicAssetImage
                        src="/QKlogo.png.svg"
                        alt="Logo"
                        sx={{
                            width: 'auto',
                            height: '36px',
                            maxWidth: '100%',
                            display: 'block',
                            objectFit: 'contain',
                            filter: isDark ? 'brightness(0) invert(1)' : 'none',
                        }}
                    />
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: `${SIDE.menuGap}px`,
                        width: '100%',
                        paddingTop: `${SIDE.menuContainerPaddingTop}px`,
                    }}
                >
                    {menuItems.map((item) => {
                        const selected = currentTab === item.id;
                        return (
                            <Box
                                key={item.id}
                                onClick={() => {
                                    onChangeTab(item.id);
                                    if (item.id === 'test') {
                                        setSelectedSetting('test');
                                    } else if (item.id === 'keyboard') {
                                        setSelectedSetting('keypress');
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onChangeTab(item.id);
                                        if (item.id === 'test') {
                                            setSelectedSetting('test');
                                        } else if (item.id === 'keyboard') {
                                            setSelectedSetting('keypress');
                                        }
                                    }
                                }}
                                sx={{
                                    borderRadius: '16px',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    height: `${SIDE.menuItemHeight}px`,
                                    gap: `${SIDE.menuItemInnerGap}px`,
                                    cursor: 'pointer',
                                    backgroundColor: selected ? menuSelBg : 'transparent',
                                    color: selected ? '#ffffff' : menuIdleColor,
                                    transform: 'scale(1)',
                                    transition:
                                        'background-color 0.2s ease-out, color 0.2s ease-out, transform 0.2s ease-out',
                                    '&:hover': {
                                        backgroundColor: selected ? menuSelBg : menuIdleHoverBg,
                                        transform: selected ? 'scale(1)' : 'scale(1.05)',
                                    },
                                    '&:active': {
                                        backgroundColor: selected ? menuSelBg : menuIdleHoverBg,
                                        transform: selected ? 'scale(1)' : 'scale(.95)',
                                        transition: 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)',
                                    },
                                }}
                            >
                                <PublicAssetImage
                                    src={SIDEBAR_MENU_ICON_SRC[item.id]}
                                    alt=""
                                    aria-hidden
                                    sx={{
                                        width: `${SIDE.menuIconSize}px`,
                                        height: `${SIDE.menuIconSize}px`,
                                        objectFit: 'contain',
                                        flexShrink: 0,
                                        zIndex: 1,
                                        display: 'block',
                                        filter: isDark
                                            ? 'brightness(0) invert(1)'
                                            : selected
                                              ? 'brightness(0) invert(1)'
                                              : 'none',
                                        transition: 'filter 0.2s ease-out',
                                    }}
                                />
                                <Box
                                    sx={{
                                        fontSize: `${SIDE.menuFontSize}px`,
                                        fontWeight: selected ? (isDark ? 700 : 600) : isDark ? 400 : SIDE.menuFontWeight,
                                        maxWidth: '90%',
                                        lineHeight: 1.2,
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                        overflowWrap: 'anywhere',
                                        textAlign: 'center',
                                        zIndex: 1,
                                        color: 'inherit',
                                    }}
                                >
                                    {item.label}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>


                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: `${SIDE.bottomGap}px`,
                    }}
                >
                    <Box
                        sx={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            position: 'relative',
                            gap: `${SIDE.langSectionGap}px`,
                            '& svg': { flexShrink: 0 },
                        }}
                    >
                        <Box
                            sx={{
                                color: isDark ? DARK_SIDE.orange : theme.palette.text.primary,
                                lineHeight: 0,
                                '& svg path': { fill: 'currentColor' },
                            }}
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30" fill="none">
                            <path
                                fillRule="evenodd"
                                fill="currentColor"
                                d="M17 0L3 0C1.34315 0 0 1.34315 0 3L0 17C0 18.6569 1.34315 20 3 20L17 20C18.6569 20 20 18.6569 20 17L20 3C20 1.34315 18.6569 0 17 0ZM15 6.13913L10.7475 6.13913L10.7475 4L9.21569 4L9.21569 6.13913L5 6.13913L5 12.2435L9.21569 12.2435L9.21569 16L10.7475 16L10.7475 12.2435L15 12.2435L15 6.13913ZM6.53186 10.6652L6.53186 7.73043L9.21569 7.73043L9.21569 10.6652L6.53186 10.6652ZM13.4559 10.6652L10.7475 10.6652L10.7475 7.73043L13.4559 7.73043L13.4559 10.6652Z"
                            />
                            <g clipPath="url(#sidebar-lang-clip)">
                                <path
                                    fillRule="evenodd"
                                    fill="currentColor"
                                    d="M10 21L10 27C10 28.6569 11.3431 30 13 30L27.0001 30C28.6569 30 30.0001 28.6569 30.0001 27L30.0001 13C30.0001 11.3431 28.6569 10 27.0001 10L21 10L21 15.8979L25 25L23.2512 25L22.1301 22.3224L17.6906 22.3224L16.6144 25L15 25L16.6921 21L10 21ZM18.3175 20.7779L18.2138 21.0383L21.592 21.0383L20.6151 18.714C20.1589 19.6746 19.3311 20.4244 18.3175 20.7779Z"
                                />
                            </g>
                            <defs>
                                <clipPath id="sidebar-lang-clip">
                                    <path d="M0 30L30 30L30 0L0 0L0 30Z" fill="white" />
                                </clipPath>
                            </defs>
                        </svg>
                        </Box>
                        <Box
                            sx={{
                                width: `${SIDE.langBtnWidth}px`,
                                position: 'relative',
                            }}
                        >
                            <Box
                                onClick={() => setLanguageMenuOpen((prev) => !prev)}
                                role="button"
                                tabIndex={0}
                                onBlur={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                                        setLanguageMenuOpen(false);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setLanguageMenuOpen((prev) => !prev);
                                    }
                                    if (e.key === 'Escape') {
                                        setLanguageMenuOpen(false);
                                    }
                                }}
                                sx={{
                                    width: `${SIDE.langBtnWidth}px`,
                                    height: `${SIDE.langBtnHeight}px`,
                                    borderRadius: `${SIDE.langBtnRadius}px`,
                                    border: isDark
                                        ? `1px solid ${alpha(DARK_SIDE.orange, 0.55)}`
                                        : `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                                    fontSize: `${SIDE.langFontSize}px`,
                                    fontWeight: SIDE.langFontWeight,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    backgroundColor: isDark ? darkAccent : menuSelectedBg,
                                    color: '#ffffff',
                                    transition: 'all 0.2s ease-out',
                                }}
                            >
                                {localeLabels[activeLanguage] ?? activeLanguage}
                            </Box>

                            {languageMenuOpen ? (
                                <Box
                                    onMouseDown={(e) => e.preventDefault()}
                                    sx={{
                                        position: 'absolute',
                                        left: 0,
                                        bottom: `calc(100% + 8px)`,
                                        width: `${SIDE.langBtnWidth}px`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        border: isDark
                                            ? `1px solid ${alpha(DARK_SIDE.orange, 0.35)}`
                                            : `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                                        borderRadius: '18px',
                                        padding: '6px 0',
                                        backgroundColor: isDark ? '#252526' : '#ffffff',
                                        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.55)' : '0 8px 20px rgba(15, 23, 42, 0.12)',
                                        zIndex: 10,
                                    }}
                                >
                                    {languages.map((lang) => {
                                        const selectedLang = activeLanguage === lang;
                                        return (
                                            <Box
                                                key={lang}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    i18n.changeLanguage(lang);
                                                    setLanguageMenuOpen(false);
                                                }}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        i18n.changeLanguage(lang);
                                                        setLanguageMenuOpen(false);
                                                    }
                                                }}
                                                sx={{
                                                    width: `${SIDE.langBtnWidth - 4}px`,
                                                    height: `${SIDE.langBtnHeight}px`,
                                                    borderRadius: `${SIDE.langBtnRadius}px`,
                                                    fontSize: `${SIDE.langFontSize}px`,
                                                    fontWeight: SIDE.langFontWeight,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    backgroundColor: selectedLang ? (isDark ? darkAccent : menuSelectedBg) : 'transparent',
                                                    color: selectedLang ? '#ffffff' : isDark ? DARK_SIDE.text : menuColor,
                                                    transition: 'all 0.2s ease-out',
                                                    '&:hover': {
                                                        backgroundColor: selectedLang
                                                            ? isDark
                                                                ? darkAccent
                                                                : menuSelectedBg
                                                            : isDark
                                                              ? DARK_SIDE.hoverWash
                                                              : menuHoverBg,
                                                    },
                                                }}
                                            >
                                                {localeLabels[lang] ?? lang}
                                            </Box>
                                        );
                                    })}
                                </Box>
                            ) : null}
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            fontSize: `${SIDE.versionFontSize}px`,
                            fontWeight: 500,
                            color: isDark ? DARK_SIDE.textSoft : theme.palette.text.secondary,
                            height: `${SIDE.versionLineHeight}px`,
                            lineHeight: `${SIDE.versionLineHeight}px`,
                            textAlign: 'center',
                        }}
                    >
                        IO v{packageInfo.version}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
