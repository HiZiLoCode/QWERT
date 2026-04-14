import { Box, Button, Flex, Image } from "@chakra-ui/react";
import { useContext, useState, useEffect } from "react";
import { MainContext } from "@/providers/MainProvider";
import { useTranslation } from "@/app/i18n";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";

type HomePageProps = {
  onAuthorized?: () => void;
};

export default function HomePage({ onAuthorized }: HomePageProps) {
  const { connectDevice } = useContext(MainContext);
  const { t } = useTranslation("common");
  const { connectedKeyboard } = useContext(ConnectKbContext);

  // 用于控制屏幕动画效果
  const [, setScreenAnimation] = useState(0);

  // 屏幕动画效果自动切换
  useEffect(() => {
    if (!connectedKeyboard) return;
    void connectedKeyboard.lightOn();
    onAuthorized?.();

    const timer = setInterval(() => {
      setScreenAnimation((prev: number) => (prev + 1) % 3);
    }, 3000);
    const timer2 = setInterval(async () => {
      const data = await connectedKeyboard.checkLightStatus()
      if (!data.status) {
        await connectedKeyboard.lightOn()
      }
    }, 1000)
    return () => {
      clearInterval(timer);
      clearInterval(timer2);
    };
  }, [connectedKeyboard, onAuthorized]);
  // 定义一个connect函数
  const connect = async () => {
    // 调用connectDevice函数
    await connectDevice([{ usagePage: 0x00ff, usage: 0x0001 }]);
    if (connectedKeyboard) {
      onAuthorized?.();
    }
  };
  return (
    <Box w="100%" h="100%" position="relative">
      {/* 动态背景 */}


      {/* 内容区域 */}
      <Box
        w="100%"
        h="100vh"
        position="relative"
        zIndex={1}
        overflowY="auto"
        overflowX="hidden"
        pb="3rem" // 为底部导航腾出空间
        sx={{
          '@keyframes gridMove': {
            '0%': { transform: 'translateY(0) scale(1)' },
            '50%': { transform: 'translateY(-1.25rem) scale(1.05)' },
            '100%': { transform: 'translateY(0) scale(1)' },
          },
          '@keyframes blink': {
            '0%': { opacity: 0.3, transform: 'scale(0.8)' },
            '50%': { opacity: 1, transform: 'scale(1.2)' },
            '100%': { opacity: 0.3, transform: 'scale(0.8)' },
          },
          '@keyframes gradientShift': {
            '0%': { opacity: 0.7 },
            '50%': { opacity: 0.9 },
            '100%': { opacity: 0.7 },
          },
          '@keyframes floatEffect': {
            '0%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(-0.625rem)' },
            '100%': { transform: 'translateY(0px)' },
          },
          '@keyframes particleFloat': {
            '0%': { transform: 'translateY(0px) translateX(0px)' },
            '50%': { transform: 'translateY(-0.625rem) translateX(0.3125rem)' },
            '100%': { transform: 'translateY(0px) translateX(0px)' },
          },
          '@keyframes pulseGlow': {
            '0%': { opacity: 0.3 },
            '50%': { opacity: 0.8 },
            '100%': { opacity: 0.3 },
          },
          '@keyframes keyPress': {
            '0%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(0.125rem)' },
            '100%': { transform: 'translateY(0px)' },
          },
          '@keyframes pixelate': {
            '0%': { filter: 'none' },
            '5%': { filter: 'brightness(1.1) contrast(1.3)' },
            '10%': { filter: 'none' },
            '15%': { filter: 'brightness(0.9) contrast(1.2)' },
            '20%': { filter: 'none' },
            '100%': { filter: 'none' },
          },
          '@keyframes scanline': {
            '0%': { transform: 'translateY(-100%)' },
            '100%': { transform: 'translateY(100%)' },
          },
          '@keyframes textFlow': {
            '0%': { backgroundPosition: '200% center' },
            '100%': { backgroundPosition: '0% center' }
          },
          '@keyframes screenFlicker': {
            '0%': { opacity: 1 },
            '49%': { opacity: 1 },
            '50%': { opacity: 0.95 },
            '51%': { opacity: 1 },
            '52%': { opacity: 1 },
            '53%': { opacity: 0.9 },
            '54%': { opacity: 1 },
            '100%': { opacity: 1 },
          },
          '&::-webkit-scrollbar': { width: '0.1875rem' }, // 3px -> 0.1875rem
        }}
      >

        {/* 中央内容 */}
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          px={4}
          pt={{ base: 6, md: 8 }}
          position="relative"
          width="100%"
          height="100%"
        >
          {/* 标题 */}
          <Box
            fontSize="2.25rem" // 36px -> 2.25rem
            fontWeight="bold"
            whiteSpace={{ base: "normal", md: "nowrap" }}
            textAlign="center"
            display="inline-block"
            position="relative"
            letterSpacing={{ base: "0.0625rem", md: "0.125rem" }}
            px={3}
            mb={4}
            className="gradient-text"
            sx={{
              background: 'linear-gradient(90deg, #00BFFF, #0080FF, #1E90FF, #0080FF, #00BFFF)',
              backgroundSize: '200% auto',
              animation: 'textFlow 3s linear infinite',
              backgroundClip: 'text',
              textFillColor: 'transparent',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 1.25rem rgba(0, 150, 255, 0.5)', // 20px -> 1.25rem
              filter: 'drop-shadow(0 0.125rem 0.25rem rgba(0, 0, 0, 0.3))' // 修正单位，4px -> 0.25rem
            }}
          >
            {t("10") || t("9005")}
          </Box>


          {/* LCD屏幕模拟 */}
          <Box
            w={{ base: "90%", sm: "85%", md: "75%", lg: "65%" }}
            maxW="43.75rem" // 700px -> 43.75rem
            borderRadius="0.5rem"
            overflow="hidden"
            marginTop="3.125rem" // 50px -> 3.125rem

            position="relative"
            boxShadow="0 0 2.5rem rgba(0, 150, 255, 0.4)" // 40px -> 2.5rem
            mb={{ base: "3.125rem", md: "3.75rem" }} // 50px -> 3.125rem, 60px -> 3.75rem
          >
            {/* 屏幕边框 */}
            <Box
              position="absolute"
              top="-0.125rem"
              left="-0.125rem"
              right="-0.125rem"
              bottom="-0.125rem"
              bg="rgba(30, 30, 50, 0.95)"
              borderRadius="0.625rem"
              zIndex={0}
              boxShadow="inset 0 0 0.625rem rgba(0, 0, 0, 0.5)" // 10px -> 0.625rem
            />

            {/* 屏幕主体 */}
            <Box
              position="relative"
              zIndex={1}
              pt="56.25%" // 16:9 宽高比
              overflow="hidden"
              border="0.25rem solid "
              borderRadius="0.375rem"
              width="43.75rem" // 700px -> 43.75rem
              sx={{
                animation: 'screenFlicker 8s infinite',
              }}
            >
              {/* 屏幕内容 */}
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexDirection="column"
                overflow="hidden"
              >
                {/* 播放LCD.gif动画 */}
                <Box
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  bottom="0"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Image
                    src="./default/default1.gif"
                    alt="LCD Screen Animation"
                    width="100%"
                    height="100%"
                    objectFit="cover"
                    style={{ mixBlendMode: 'lighten' }}
                  />
                </Box>

                {/* 屏幕扫描线 */}
                <Box
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  height="0.125rem" // 2px -> 0.125rem
                  bg="rgba(255, 255, 255, 0.1)"
                  sx={{ animation: 'scanline 3s linear infinite' }}
                />

                {/* 像素网格效果 */}
                <Box
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  bottom="0"
                  backgroundImage="url('./pixel_grid.png')"
                  backgroundSize="cover"
                  opacity={0.05}
                  pointerEvents="none"
                />
              </Box>
            </Box>
          </Box>

          {/* 连接键盘按钮 */}
          <Button
            as="button"
            onClick={() => connect()}
            bg="rgba(0, 150, 255, 0.8)"
            color="white"
            _hover={{ bg: "rgba(0, 180, 255, 0.9)" }}
            _active={{ bg: "rgba(0, 120, 255, 1)" }}
            borderRadius="md"
            px={10}
            py={6}
            fontSize="2rem" // 32px -> 2rem
            fontWeight="bold"
            boxShadow="0 0 1.25rem rgba(0, 150, 255, 0.5)" // 20px -> 1.25rem
            transition="all 0.2s ease"
            position="relative"
            marginTop="3.125rem" // 50px -> 3.125rem
            _before={{
              content: '""',
              position: 'absolute',
              top: '-0.1875rem', // 3px -> 0.1875rem
              left: '-0.1875rem', // 3px -> 0.1875rem
              right: '-0.1875rem', // 3px -> 0.1875rem
              bottom: '-0.1875rem', // 3px -> 0.1875rem
              borderRadius: 'md',
              padding: '0.1875rem', // 3px -> 0.1875rem
              background: 'linear-gradient(90deg, #00BFFF, #0080FF, #1E90FF, #0080FF, #00BFFF)',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'xor',
              animation: 'textFlow 3s linear infinite',
            }}
          >
            <span>{t("16") || "连接设备"}</span>
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}