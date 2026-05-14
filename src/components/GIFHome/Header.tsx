import { MainContext } from "@/providers/MainProvider";
import {
  Box,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  HStack,
  VStack
} from "@chakra-ui/react";
import { useContext } from "react";
import { useTranslation } from "@/app/i18n";
import { MdLanguage } from "react-icons/md";

function Header() {
  const { changeLanguage, i18n } = useTranslation("common");
  const {
    t,
  } = useContext(MainContext);

  // 切换语言
  const switcLanguage = async (language: string) => {
    changeLanguage(language);
  }

  return (
    <>
      <style jsx global>{`
        /* 科技感渐变动画 */
        @keyframes techGradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        @keyframes titlePulse {
          0%, 100% {
            text-shadow: 
              0 0 5px rgba(100, 150, 255, 0.5),
              0 0 10px rgba(100, 150, 255, 0.3),
              0 0 15px rgba(100, 150, 255, 0.2);
          }
          50% {
            text-shadow: 
              0 0 10px rgba(100, 150, 255, 0.8),
              0 0 20px rgba(100, 150, 255, 0.6),
              0 0 30px rgba(100, 150, 255, 0.4);
          }
        }
        
        .tech-header {
          background: linear-gradient(
            135deg,
            rgba(15, 25, 45, 0.95) 0%,
            rgba(25, 35, 55, 0.95) 25%,
            rgba(35, 45, 65, 0.95) 50%,
            rgba(25, 35, 55, 0.95) 75%,
            rgba(15, 25, 45, 0.95) 100%
          );
          background-size: 400% 400%;
          animation: techGradient 8s ease infinite;
          backdrop-filter: blur(12px);
          border-bottom: 0.125remsolid rgba(100, 150, 255, 0.3);
          box-shadow: 
            0 4px 20px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          position: relative;
        }
        
        .tech-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(100, 150, 255, 0.6) 50%,
            transparent 100%
          );
        }
        
        .tech-title {
          background: linear-gradient(
            90deg,
            #667eea 0%,
            #764ba2 25%,
            #f093fb 50%,
            #764ba2 75%,
            #667eea 100%
          );
          background-size: 200% auto;
          animation: techGradient 4s linear infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          font-weight: 700;
          font-size: 20px;
          letter-spacing: 1px;
          animation: titlePulse 3s ease-in-out infinite;
          display: inline-block;
          position: relative;
        }
        
        .lang-button {
          background: rgba(100, 150, 255, 0.1);
          border: 1px solid rgba(100, 150, 255, 0.3);
          backdrop-filter: blur(8px);
          transition: all 0.3s ease;
        }
        
        .lang-button:hover {
          background: rgba(100, 150, 255, 0.2);
          border-color: rgba(100, 150, 255, 0.5);
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(100, 150, 255, 0.2);
        }
      `}</style>
      
      <Box 
        className="tech-header"
        h="68px"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={6}
        position="relative"
        zIndex={9000}
      >
        {/* 中间 - 应用标题 */}
        <Box 
          position="absolute" 
          left="50%" 
          transform="translateX(-50%)" 
          textAlign="center"
        >
          <Text className="tech-title">
            {t("11")}
          </Text>
        </Box>
      </Box>
    </>
  );
}

export default Header;