import { styled } from "@mui/material";

export const LoadingText = styled("div")`
  height: 60px;
  font-size: 48px;
  font-family: Arial, Helvetica, sans-serif;
  font-weight: bold;
  color: #0a0101;
  text-shadow: 0 0 0.125remvar(--key--color_accent),
    0 0 1px var(--key--color_accent), 0 0 1px var(--key--color_accent);
  letter-spacing: 2px;
  position: relative;
  &::after {
    height: 80px;
    content: "loading...";
    position: absolute;
    left: 0;
    top: 1;
    color: #1976d2;
    width: 100%;
    overflow: hidden;
    animation: loderWidth 6s linear infinite;
  }
  @keyframes loderWidth {
    0% {
      width: 0%;
    }
    100% {
      width: 100%;
    }
  }
`;

export const InsideLoadingContainer = styled("div")(({ theme }) => ({
  display: "grid",
  placeContent: "center",
  background: theme.palette.background.default,
  height: "100%",
  margin: "0",
  width: "100%",
  "& svg": {
    width: "100%",
  },
  "& .single": {
    // 调整缩放至合适的大小
    transform: "scale(0.6) rotate(0)",
    // 添加旋转动画
    animation: "spin 2s ease-in-out infinite",
  },
}));
export const ProgressBarContainer = styled("div")`
  position: relative;
  width: 320px;
  height: 16px;
  background-color: #4a5568;
  border-radius: 9999px;
  overflow: hidden;
  @keyframes spin {
    to {
      transform: scale(0.6) rotate(1turn);
    }
  }
`;

export const ProgressBar = styled("div")`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 0;
  background: linear-gradient(to right, #c6c09c, #ffc98b, #e79796);
  border-radius: 9999px;
  animation: progressAnimation 3s infinite;
  transition: width 0.2s ease-in-out;
  @keyframes progressAnimation {
    0% {
      width: 0%;
    }
    50% {
      width: 50%;
    }
    100% {
      width: 100%;
    }
  }
`;

export const LoadingSpan = styled("span")`
  display: inline-block;
  margin-top: 20px;
  height: 60px;
`;
