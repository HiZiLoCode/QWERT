'use client';

import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { useTranslation } from '@/app/i18n';
import { Box, Typography, createSvgIcon } from '@mui/material';
import { CSSProperties, useContext } from 'react';
import { ButtonRem } from '@/styled/ReconstructionRem';

/** 原设计稿按 16px = 1rem 换算，与整页 Rem 缩放一致 */
const HERO_GLOW_VIEWBOX = 498;
const HERO_GLOW_SIZE_REM = `${HERO_GLOW_VIEWBOX / 16}rem`;

const HERO = {
    bgOffsetLeft: '-15rem',
    bgOffsetTop: '-28.9375rem',
    bgOriginBottom: '2.3125rem',
} as const;

const PlusIcon = createSvgIcon(
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>,
    'Plus',
);

export default function HeroSection() {
    const { connectKeyboard } = useContext(ConnectKbContext);
    const { t } = useTranslation('common');

    const wrapperStyles: CSSProperties = {
        width: '31rem',
        height: '31rem',
        margin: '6rem auto',
        position: 'relative',
    };

    const glowLayerBase: CSSProperties = {
        position: 'absolute',
        left: HERO.bgOffsetLeft,
        top: HERO.bgOffsetTop,
        width: HERO_GLOW_SIZE_REM,
        height: HERO_GLOW_SIZE_REM,
        transformOrigin: `center calc(100% - ${HERO.bgOriginBottom})`,
    };

    const ringsStyles: CSSProperties = {
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        position: 'absolute',
    };


    return (
        <Box className="w-full h-full">
            <style>{`
        @keyframes rotateBg {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.05); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .hero-rings::before,
        .hero-rings::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 0.0625rem solid rgba(120, 160, 255, 0.3);
        }

        .hero-rings::after {
          transform: scale(1.2);
        }

        .hero-rings::before {
          transform: scale(1);
        }

        .hero-wrapper::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 0.0625rem solid rgba(120, 160, 255, 0.3);
          transform: scale(1.4);
        }

        .hero-wrapper {
          animation: rotateBg 12s linear infinite !important;
        }

        :where(*) {
            border-width: 0rem;
            border-style: solid;
            box-sizing: border-box;
            overflow-wrap: break-word
        }
      `}</style>
            <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                <Box sx={{
                    gap: "1rem", display: 'flex', flexDirection: "column", position: "absolute",
                    left: "12rem",
                    bottom: "24%"
                }}>
                    <Box
                        component="img"
                        src="/qk-text-logo.svg"
                        alt="QWERTYKEYS"
                        sx={{ width: 'min(32.5rem, 100%)', height: 'auto', display: 'block' }}
                    />
                    <Typography
                        variant="body1"
                        sx={{
                            maxWidth: '40rem',
                            color: 'rgb(30, 41, 59)',
                            lineHeight: '2rem',
                            fontWeight: 300,
                            fontSize: '1rem',
                        }}
                    >
                        {t('2560')}
                    </Typography>
                    <Box sx={{ gap: '1rem', display: 'flex', mt: '2rem' }}>
                        <ButtonRem
                            variant="contained"
                            size="large"
                            startIcon={<PlusIcon />}
                            sx={{
                                width: '10rem',
                                height: '3rem',
                                minWidth: 0,
                                px: '0.75rem',
                                fontSize: '0.875rem',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                '& .MuiButton-startIcon': {
                                    mr: '0.375rem',
                                    ml: 0,
                                },
                                '& .MuiButton-startIcon > *:nth-of-type(1)': {
                                    fontSize: '1rem',
                                },
                            }}
                            onClick={() => connectKeyboard('tryConnect')}
                        >
                            {t('2561')}
                        </ButtonRem>
                        <ButtonRem
                            size="large"
                            variant="outlined"
                            sx={{
                                width: '10rem',
                                height: '3rem',
                                minWidth: 0,
                                px: '0.75rem',
                                fontSize: '0.875rem',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                            }}
                            onClick={() => connectKeyboard('demo', false)}
                        >
                            {t('2562')}
                        </ButtonRem>
                    </Box>
                </Box>
                <Box sx={{ position: "absolute", left: "70%", display: "flex", alignItems: "center", height: "100%" }}>
                    <Box style={wrapperStyles} className="hero-wrapper" >
                        <Box sx={{
                            position: "relative",
                            animation: "12s linear 0s infinite normal none running rotate",
                            top: "16rem",
                            left: "15rem",
                        }}>
                            <Box style={glowLayerBase} sx={{ color: ' rgb(254, 254, 179)' }}>
                                <svg
                                    width="100%"
                                    height="100%"
                                    viewBox={`0 0 ${HERO_GLOW_VIEWBOX} ${HERO_GLOW_VIEWBOX}`}
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    style={{ display: 'block' }}
                                >
                                    <g opacity="0.35" filter="url(#filter_#ff9000_#ffc300)">
                                        <path
                                            d="M404.589 174.674C445.622 260.62 409.212 363.557 323.266 404.59C237.319 445.622 134.382 409.212 93.3499 323.266C52.3174 237.319 88.7273 134.382 174.674 93.3499C260.62 52.3173 363.557 88.7273 404.589 174.674Z"
                                            fill="url(#paint_#ff9000_#ffc300)"
                                        />
                                    </g>
                                    <defs>
                                        <filter
                                            id="filter_#ff9000_#ffc300"
                                            x="-57.4303"
                                            y="-57.4303"
                                            width="612.8"
                                            height="612.8"
                                            filterUnits="userSpaceOnUse"
                                            colorInterpolationFilters="sRGB"
                                        >
                                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                                            <feGaussianBlur stdDeviation="38.2421" result="effect1_foregroundBlur_228_17401" />
                                        </filter>
                                        <radialGradient
                                            id="paint_#ff9000_#ffc300"
                                            cx="0"
                                            cy="0"
                                            r="1"
                                            gradientUnits="userSpaceOnUse"
                                            gradientTransform="translate(267.613 271.956) rotate(-124.171) scale(340.939 340.939)"
                                        >
                                            <stop stopColor="#ff9000" />
                                            <stop offset="0.4" stopColor="#ffc300" />
                                            <stop offset="0.7" stopOpacity="0" />
                                        </radialGradient>
                                    </defs>
                                </svg>
                            </Box>
                            <Box style={glowLayerBase} sx={{ color: ' rgb(121, 178, 255)', rotate: '120deg' }}>
                                <svg
                                    width="100%"
                                    height="100%"
                                    viewBox={`0 0 ${HERO_GLOW_VIEWBOX} ${HERO_GLOW_VIEWBOX}`}
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    style={{ display: 'block' }}
                                >
                                    <g opacity="0.35" filter="url(#filter_#0072FF_#3B82F6)">
                                        <path
                                            d="M404.589 174.674C445.622 260.62 409.212 363.557 323.266 404.59C237.319 445.622 134.382 409.212 93.3499 323.266C52.3174 237.319 88.7273 134.382 174.674 93.3499C260.62 52.3173 363.557 88.7273 404.589 174.674Z"
                                            fill="url(#paint_#0072FF_#3B82F6)"
                                        />
                                    </g>
                                    <defs>
                                        <filter
                                            id="filter_#0072FF_#3B82F6"
                                            x="-57.4303"
                                            y="-57.4303"
                                            width="612.8"
                                            height="612.8"
                                            filterUnits="userSpaceOnUse"
                                            colorInterpolationFilters="sRGB"
                                        >
                                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                                            <feGaussianBlur stdDeviation="38.2421" result="effect1_foregroundBlur_228_17401" />
                                        </filter>
                                        <radialGradient
                                            id="paint_#0072FF_#3B82F6"
                                            cx="0"
                                            cy="0"
                                            r="1"
                                            gradientUnits="userSpaceOnUse"
                                            gradientTransform="translate(267.613 271.956) rotate(-124.171) scale(340.939 340.939)"
                                        >
                                            <stop stopColor="#0072FF" />
                                            <stop offset="0.4" stopColor="#3B82F6" />
                                            <stop offset="0.7" stopOpacity="0" />
                                        </radialGradient>
                                    </defs>
                                </svg>
                            </Box>
                            <Box style={glowLayerBase} sx={{ color: ' rgb(254, 254, 179)', rotate: '240deg' }}>
                                <svg
                                    width="100%"
                                    height="100%"
                                    viewBox={`0 0 ${HERO_GLOW_VIEWBOX} ${HERO_GLOW_VIEWBOX}`}
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    style={{ display: 'block' }}
                                >
                                    <g opacity="0.35" filter="url(#filter_#F6FF00_#FFFB00)">
                                        <path
                                            d="M404.589 174.674C445.622 260.62 409.212 363.557 323.266 404.59C237.319 445.622 134.382 409.212 93.3499 323.266C52.3174 237.319 88.7273 134.382 174.674 93.3499C260.62 52.3173 363.557 88.7273 404.589 174.674Z"
                                            fill="url(#paint_#F6FF00_#FFFB00)"
                                        />
                                    </g>
                                    <defs>
                                        <filter
                                            id="filter_#F6FF00_#FFFB00"
                                            x="-57.4303"
                                            y="-57.4303"
                                            width="612.8"
                                            height="612.8"
                                            filterUnits="userSpaceOnUse"
                                            colorInterpolationFilters="sRGB"
                                        >
                                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                                            <feGaussianBlur stdDeviation="38.2421" result="effect1_foregroundBlur_228_17401" />
                                        </filter>
                                        <radialGradient
                                            id="paint_#F6FF00_#FFFB00"
                                            cx="0"
                                            cy="0"
                                            r="1"
                                            gradientUnits="userSpaceOnUse"
                                            gradientTransform="translate(267.613 271.956) rotate(-124.171) scale(340.939 340.939)"
                                        >
                                            <stop stopColor="#F6FF00" />
                                            <stop offset="0.4" stopColor="#FFFB00" />
                                            <stop offset="0.7" stopOpacity="0" />
                                        </radialGradient>
                                    </defs>
                                </svg>
                            </Box>
                        </Box>
                        <Box style={ringsStyles} className="hero-rings" />
                    </Box>
                </Box>

            </Box>
        </Box>
    );
}

