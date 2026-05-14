import { Box, Button, Flex, Image } from "@chakra-ui/react";
import { useCallback, useContext, useState, useEffect } from "react";
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOpeningDevice, setIsOpeningDevice] = useState(false);
  const [openingDots, setOpeningDots] = useState(0);

  const ensureScreenOnline = useCallback(async (keyboard: any) => {
    try {
      // 不在线：保持“正在打开设备...”显示 2 秒，并在这段时间尝试点亮  延迟俩秒
      const status = await keyboard.checkLightStatus();
      if (status?.status) {
        // 已在线：不等待，但仍立即点亮屏幕
        await connectDevice([{ usagePage: 0x00ff, usage: 0x0001 }]);
        return true;
      }
    } catch {
      // 状态读取失败时，继续尝试亮屏流程
    }
    setIsOpeningDevice(true);
    setOpeningDots(0);
    try {
      // 不在线：保持“正在打开设备...”显示 2 秒，并在这段时间尝试点亮
      // 立刻下发点亮命令，不等待它完成；授权仍然在 2 秒后弹出
      void keyboard.lightOn()

      await new Promise((resolve) => setTimeout(resolve, 2000));
      setIsConnecting(true);
      await connectDevice([{ usagePage: 0x00ff, usage: 0x0001 }]);
      return true;
    } finally {
      setIsOpeningDevice(false);
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setScreenAnimation((prev: number) => (prev + 1) % 3);
    }, 3000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isOpeningDevice) return;
    const timer = setInterval(() => {
      setOpeningDots((prev) => (prev + 1) % 3);
    }, 500);
    return () => clearInterval(timer);
  }, [isOpeningDevice]);

  // 定义一个connect函数
  const connect = async () => {
    if (isConnecting || isOpeningDevice) return;

    if (connectedKeyboard) {
      const ok = await ensureScreenOnline(connectedKeyboard);
      console.log(ok);
      
      if (ok) {
        onAuthorized?.();
      }
      return;
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
        pb="48px" // 为底部导航腾出空间
        sx={{
          '@keyframes gridMove': {
            '0%': { transform: 'translateY(0) scale(1)' },
            '50%': { transform: 'translateY(-20px) scale(1.05)' },
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
            '50%': { transform: 'translateY(-10px)' },
            '100%': { transform: 'translateY(0px)' },
          },
          '@keyframes particleFloat': {
            '0%': { transform: 'translateY(0px) translateX(0px)' },
            '50%': { transform: 'translateY(-10px) translateX(5px)' },
            '100%': { transform: 'translateY(0px) translateX(0px)' },
          },
          '@keyframes pulseGlow': {
            '0%': { opacity: 0.3 },
            '50%': { opacity: 0.8 },
            '100%': { opacity: 0.3 },
          },
          '@keyframes keyPress': {
            '0%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(2px)' },
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
          '&::-webkit-scrollbar': { width: '3px' }, // 3px -> 3px
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
            fontSize="36px"
            fontWeight="bold"
            whiteSpace={{ base: "normal", md: "nowrap" }}
            textAlign="center"
            display="inline-block"
            position="relative"
            letterSpacing={{ base: "1px", md: "2px" }}
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
              textShadow: '0 0 20px rgba(0, 150, 255, 0.5)', // 20px -> 20px
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' // 修正单位，4px -> 4px
            }}
          >
            {t("10") || t("9005")}
          </Box>


          {/* LCD屏幕模拟 */}
          <Box
            w={{ base: "90%", sm: "85%", md: "75%", lg: "65%" }}
            maxW="700px" // 700px -> 700px
            borderRadius="8px"
            overflow="hidden"
            marginTop="50px" // 50px -> 50px

            position="relative"
            boxShadow="0 0 40px rgba(0, 150, 255, 0.4)" // 40px -> 40px
            mb={{ base: "50px", md: "60px" }} // 50px -> 50px, 60px -> 60px
          >
            {/* 屏幕边框 */}
            <Box
              position="absolute"
              top="-2px"
              left="-2px"
              right="-2px"
              bottom="-2px"
              bg="rgba(30, 30, 50, 0.95)"
              borderRadius="10px"
              zIndex={0}
              boxShadow="inset 0 0 10px rgba(0, 0, 0, 0.5)" // 10px -> 10px
            />

            {/* 屏幕主体 */}
            <Box
              position="relative"
              zIndex={1}
              pt="56.25%" // 16:9 宽高比
              overflow="hidden"
              border="4px solid "
              borderRadius="6px"
              width="700px" // 700px -> 700px
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
                  height="2px" // 2px -> 2px
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
            isDisabled={isConnecting || isOpeningDevice}
            bg="rgba(0, 150, 255, 0.8)"
            color="white"
            _hover={{ bg: "rgba(0, 180, 255, 0.9)" }}
            _active={{ bg: "rgba(0, 120, 255, 1)" }}
            borderRadius="md"
            px={10}
            py={6}
            fontSize="32px"
            fontWeight="bold"
            boxShadow="0 0 20px rgba(0, 150, 255, 0.5)" // 20px -> 20px
            transition="all 0.2s ease"
            position="relative"
            marginTop="50px" // 50px -> 50px
            _before={{
              content: '""',
              position: 'absolute',
              top: '-3px', // 3px -> 3px
              left: '-3px', // 3px -> 3px
              right: '-3px', // 3px -> 3px
              bottom: '-3px', // 3px -> 3px
              borderRadius: 'md',
              padding: '3px', // 3px -> 3px
              background: 'linear-gradient(90deg, #00BFFF, #0080FF, #1E90FF, #0080FF, #00BFFF)',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'xor',
              animation: 'textFlow 3s linear infinite',
            }}
          >
            <span>
              {isConnecting
                  ? "连接中..."
                : isOpeningDevice
                  ? `正在打开设备${".".repeat(openingDots + 1)}`
                  : t("16") || "连接设备"}
            </span>
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}