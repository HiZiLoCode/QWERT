'use client';

import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { EditorContext } from '@/providers/EditorProvider';
import { useContext } from 'react';

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
    menuItemInnerGap: 5,
    menuFontSize: 18,
    menuFontWeight: 400,
    menuColor: '#64748b',
    menuSelectedBg: '#3b82f6',
    menuSelectedColor: '#fff',
    bottomGap: 40,
    langSectionGap: 16,
    langBtnWidth: 91,
    langBtnHeight: 36,
    langBtnRadius: 36,
    langFontSize: 14,
    langFontWeight: 500,
    versionFontSize: 16,
    versionLineHeight: 20,
    versionColor: '#64748b',
} as const;

export default function Sidebar() {
    const { i18n } = useTranslation();
    const { onChangeTab, currentTab } = useContext(EditorContext);
    const menuItems = [
        { id: 'keyboard', label: '键盘' },
        { id: 'settings', label: '设置' },
    ];

    const toggleLanguage = () => {
        const newLocale = i18n.language === 'zh' ? 'en' : 'zh';
        i18n.changeLanguage(newLocale);
    };

    const resolved = i18n.resolvedLanguage ?? i18n.language;
    const langLabel = resolved === 'en' ? 'English' : '中文';

    return (
        <Box
            sx={{
                height: '100%',
                width: `${SIDE.width}px`,
                position: 'relative',
                backgroundColor: SIDE.bg,
                boxShadow: SIDE.shadow,
                flexShrink: 0,
            }}
        >
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
                    <Box
                        component="img"
                        src="/qk-logo.svg"
                        alt="Logo"
                        sx={{
                            width: 'auto',
                            height: '48px',
                            maxWidth: '100%',
                            display: 'block',
                            objectFit: 'contain',
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
                                onClick={() => onChangeTab(item.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onChangeTab(item.id);
                                    }
                                }}
                                sx={{
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    height: `${SIDE.menuItemHeight}px`,
                                    gap: `${SIDE.menuItemInnerGap}px`,
                                    cursor: 'pointer',
                                    backgroundColor: selected ? SIDE.menuSelectedBg : 'transparent',
                                    color: selected ? SIDE.menuSelectedColor : SIDE.menuColor,
                                    transition: 'background-color 0.2s ease-out, color 0.2s ease-out',
                                }}
                            >
                                <Box
                                    sx={{
                                        fontSize: `${SIDE.menuFontSize}px`,
                                        fontWeight: SIDE.menuFontWeight,
                                        height: '18px',
                                        lineHeight: 1,
                                        whiteSpace: 'nowrap',
                                        zIndex: 1,
                                        color: selected ? SIDE.menuSelectedColor : SIDE.menuColor,
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
                        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30" fill="none">
                            <path
                                fillRule="evenodd"
                                fill="#000000"
                                d="M17 0L3 0C1.34315 0 0 1.34315 0 3L0 17C0 18.6569 1.34315 20 3 20L17 20C18.6569 20 20 18.6569 20 17L20 3C20 1.34315 18.6569 0 17 0ZM15 6.13913L10.7475 6.13913L10.7475 4L9.21569 4L9.21569 6.13913L5 6.13913L5 12.2435L9.21569 12.2435L9.21569 16L10.7475 16L10.7475 12.2435L15 12.2435L15 6.13913ZM6.53186 10.6652L6.53186 7.73043L9.21569 7.73043L9.21569 10.6652L6.53186 10.6652ZM13.4559 10.6652L10.7475 10.6652L10.7475 7.73043L13.4559 7.73043L13.4559 10.6652Z"
                            />
                            <g clipPath="url(#sidebar-lang-clip)">
                                <path
                                    fillRule="evenodd"
                                    fill="#000000"
                                    d="M10 21L10 27C10 28.6569 11.3431 30 13 30L27.0001 30C28.6569 30 30.0001 28.6569 30.0001 27L30.0001 13C30.0001 11.3431 28.6569 10 27.0001 10L21 10L21 15.8979L25 25L23.2512 25L22.1301 22.3224L17.6906 22.3224L16.6144 25L15 25L16.6921 21L10 21ZM18.3175 20.7779L18.2138 21.0383L21.592 21.0383L20.6151 18.714C20.1589 19.6746 19.3311 20.4244 18.3175 20.7779Z"
                                />
                            </g>
                            <defs>
                                <clipPath id="sidebar-lang-clip">
                                    <path d="M0 30L30 30L30 0L0 0L0 30Z" fill="white" />
                                </clipPath>
                            </defs>
                        </svg>
                        <Box
                            onClick={toggleLanguage}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleLanguage();
                                }
                            }}
                            sx={{
                                width: `${SIDE.langBtnWidth}px`,
                                height: `${SIDE.langBtnHeight}px`,
                                borderRadius: `${SIDE.langBtnRadius}px`,
                                fontSize: `${SIDE.langFontSize}px`,
                                fontWeight: SIDE.langFontWeight,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                backgroundColor: SIDE.menuSelectedBg,
                                color: SIDE.menuSelectedColor,
                            }}
                        >
                            {langLabel}
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            fontSize: `${SIDE.versionFontSize}px`,
                            fontWeight: 500,
                            color: SIDE.versionColor,
                            height: `${SIDE.versionLineHeight}px`,
                            lineHeight: `${SIDE.versionLineHeight}px`,
                            textAlign: 'center',
                        }}
                    >
                        IO v1.0.0
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
