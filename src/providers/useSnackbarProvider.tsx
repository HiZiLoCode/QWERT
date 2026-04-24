"use client";

import * as React from "react";
import {
  Snackbar as MUI_Snackbar,
  Fade,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Paper,
  Box,
  Typography,
  IconButton,
  Portal,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { SnackbarOrigin } from "@mui/material/Snackbar";
import { styled } from "@mui/material";

/* ---------------------------------------------
 *  自定义 Styled Snackbar
 * --------------------------------------------- */
interface StyledSnackbarProps {
  type: "success" | "error" | "info" | "warning";
}

const Snackbar = styled(MUI_Snackbar)<StyledSnackbarProps>`
  color: #ffffff !important;
  background-color: #3b82f6 !important;

  border-radius: 0.625rem;

  & > .MuiPaper-root {
    color: #ffffff !important;
    background-color: #3b82f6 !important;
    border-radius: 0.625rem;
  }

  & .MuiSnackbarContent-message {
    width: 100%;
    text-align: center;
  }
`;

/* ---------------------------------------------
 *  State 接口
 * --------------------------------------------- */
interface SnackbarState extends SnackbarOrigin {
  open: boolean;
  message: string;
  title?: string;
  type: "success" | "error" | "info" | "warning";
  duration: number;
  transition: React.ElementType;
  id: number;
  remainingTime: number;
  /** 右上角卡片 */
  presentation?: "default" | "deviceCard" | "deviceCardDark";
}

/* ---------------------------------------------
 *  Context 类型
 * --------------------------------------------- */
interface SnackbarDialogContextType {
  showMessage: (options: {
    message: string;
    title?: string;
    type?: "success" | "error" | "info" | "warning";
    duration?: number;
    presentation?: "default" | "deviceCard" | "deviceCardDark";
  }) => void;

  showDialog: (dialogProps: {
    title: string;
    content: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) => void;
}

const SnackbarDialogContext = React.createContext<
  SnackbarDialogContextType | undefined
>(undefined);

const SNACKBAR_MESSAGE_TEXT_STYLE = {
  fontSize: "0.875rem",
  fontWeight: 600,
  lineHeight: 1.4,
} as const;

function DeviceCardToast({
  title,
  message,
  onClose,
  legacyDark = false,
}: {
  title: string;
  message: string;
  onClose: () => void;
  legacyDark?: boolean;
}) {
  /** 统一 showMessage 外观：默认蓝底；legacyDark 用于兼容旧的深色设备卡片 */
  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        minWidth: { xs: 268, sm: 300 },
        maxWidth: 420,
        py: "10px",
        px: "14px",
        borderRadius: "10px",
        bgcolor: legacyDark ? "#212121" : "#3b82f6",
        color: "#fff",
        boxShadow: legacyDark
          ? "0 4px 14px rgba(0,0,0,0.35)"
          : "0 4px 14px rgba(59, 130, 246, 0.35)",
        backgroundImage: "none",
      }}
    >
      <IconButton
        size="small"
        onClick={onClose}
        aria-label="close"
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          p: "4px",
          color: legacyDark ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.72)",
          "&:hover": {
            color: "#ffffff",
            bgcolor: legacyDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)",
          },
        }}
      >
        <CloseRoundedIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          alignItems: legacyDark ? "stretch" : "center",
          justifyContent: "center",
          textAlign: legacyDark ? "left" : "center",
          pr: legacyDark ? 0.5 : 0,
        }}
      >
        {legacyDark ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                bgcolor: "#3ddc84",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckRoundedIcon sx={{ fontSize: 10, color: "#40AA19" }} />
            </Box>
            <Typography
              component="div"
              sx={{
                fontWeight: 600,
                fontSize: "0.8125rem",
                lineHeight: 1.3,
                color: "#f5f5f5",
                letterSpacing: "0.01em",
                minWidth: 0,
                flex: 1,
              }}
            >
              {title}
            </Typography>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                bgcolor: "rgba(255,255,255,0.24)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckRoundedIcon sx={{ fontSize: 12, color: "#ffffff" }} />
            </Box>
            <Typography
              component="div"
              sx={{
                fontWeight: 600,
                fontSize: "0.8125rem",
                lineHeight: 1.3,
                color: "#ffffff",
                letterSpacing: "0.01em",
                minWidth: 0,
              }}
            >
              {title}
            </Typography>
          </>
        )}
        <Typography
          component="div"
          sx={{
            ...SNACKBAR_MESSAGE_TEXT_STYLE,
            color: legacyDark ? "rgba(255,255,255,0.62)" : "#ffffff",
            opacity: legacyDark ? 1 : 0.95,
            pl: legacyDark ? "28px" : 0,
          }}
        >
          {message}
        </Typography>
      </Box>
    </Paper>
  );
}

/* ---------------------------------------------
 *  Provider
 * --------------------------------------------- */
export const SnackbarDialogProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const maxSnack = 4;

  const [snackbars, setSnackbars] = React.useState<SnackbarState[]>([]);
  const [snackbarId, setSnackbarId] = React.useState<number>(0);

  /* ---------------------------------------------
   *  showMessage (对象参数版本)
   * --------------------------------------------- */
  const showMessage = ({
    message,
    title = "",
    type = "info",
    duration = 3000,
    presentation = "default",
  }: {
    message: string;
    title?: string;
    type?: "success" | "error" | "info" | "warning";
    duration?: number;
    presentation?: "default" | "deviceCard" | "deviceCardDark";
  }) => {
    const id = snackbarId;
    setSnackbarId((s) => s + 1);

    const isCard =
      presentation === "deviceCard" || presentation === "deviceCardDark";

    const newSnackbar: SnackbarState = {
      open: true,
      message,
      title,
      type,
      duration,
      vertical: "top",
      horizontal: isCard ? "right" : "center",
      transition: Fade,
      id,
      remainingTime: duration,
      presentation,
    };

    // 添加 Snackbar
    setSnackbars((prev) => {
      const arr = [...prev, newSnackbar];
      if (arr.length > maxSnack) arr.shift();
      return arr;
    });

    // 动态透明度动画
    const interval = setInterval(() => {
      setSnackbars((prev) =>
        prev.map((sn) =>
          sn.id === id
            ? { ...sn, remainingTime: sn.remainingTime - 100 }
            : sn
        )
      );
    }, 100);

    // 自动关闭
    setTimeout(() => {
      clearInterval(interval);
      setSnackbars((prev) => prev.filter((sn) => sn.id !== id));
    }, duration);
  };

  /* ---------------------------------------------
   *  Snackbar 关闭
   * --------------------------------------------- */
  const handleClose = (id: number, reason?: string) => {
    if (reason === "clickaway") return;
    setSnackbars((prev) => prev.filter((sn) => sn.id !== id));
  };

  /* ---------------------------------------------
   *  Dialog 处理
   * --------------------------------------------- */
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogProps, setDialogProps] = React.useState({
    title: "",
    content: "",
    confirmText: "确认",
    cancelText: "取消",
    onConfirm: () => {},
    onCancel: () => {},
  });

  const showDialog: SnackbarDialogContextType["showDialog"] = ({
    title,
    content,
    confirmText = "确认",
    cancelText = "取消",
    onConfirm,
    onCancel,
  }) => {
    setDialogProps({ title, content, confirmText, cancelText, onConfirm, onCancel });
    setDialogOpen(true);
  };

  /* ---------------------------------------------
   *  Provider 渲染
   * --------------------------------------------- */
  return (
    <SnackbarDialogContext.Provider value={{ showMessage, showDialog }}>
      {children}

      {/* 渲染多个 Snackbar 排列 */}
      {snackbars.map((sn, i) => {
        const fade = Math.max(sn.remainingTime, 0);
        const opacity = fade <= 500 ? fade / 500 : 1;

        if (sn.presentation === "deviceCard" || sn.presentation === "deviceCardDark") {
          // 不用 MUI Snackbar：其内部会为滚动/锚点访问父级 scroll 容器，在部分布局下
          // 可能出现对 null 读取 scrollTop。固定层用 Portal + fixed 即可。
          return (
            <Portal key={sn.id}>
              <Box
                sx={{
                  position: "fixed",
                  top: 20 + i * 100,
                  right: { xs: 12, sm: 20 },
                  zIndex: 10000 - i,
                  opacity,
                  transition: "opacity 100ms ease-in-out",
                  pointerEvents: "none",
                  "& > *": { pointerEvents: "auto" },
                }}
              >
                <DeviceCardToast
                  title={sn.title || ""}
                  message={sn.message}
                  legacyDark={sn.presentation === "deviceCardDark"}
                  onClose={() => handleClose(sn.id)}
                />
              </Box>
            </Portal>
          );
        }

        return (
          <Snackbar
            key={sn.id}
            type={sn.type}
            anchorOrigin={{ vertical: sn.vertical, horizontal: sn.horizontal }}
            open={sn.open}
            message={
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                {sn.title && (
                  <span style={{ fontWeight: 700, marginBottom: 2, color: "#fff" }}>
                    {sn.title}
                  </span>
                )}
                <span style={{ color: "#fff", ...SNACKBAR_MESSAGE_TEXT_STYLE }}>
                  {sn.message}
                </span>
              </div>
            }
            autoHideDuration={sn.duration}
            onClose={(_event, reason) => handleClose(sn.id, reason as string)}
            TransitionComponent={sn.transition as any}
            style={{
              zIndex: 9999 - i,
              position: "absolute",
              top: `${i * 60 + 20}px`,
              opacity,
              transition: "opacity 100ms ease-in-out",
            }}
          />
        );
      })}

      {/* Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          dialogProps.onCancel();
          setDialogOpen(false);
        }}
      >
        <DialogTitle>{dialogProps.title}</DialogTitle>
        <DialogContent>
          <p>{dialogProps.content}</p>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              dialogProps.onCancel();
              setDialogOpen(false);
            }}
            color="secondary"
          >
            {dialogProps.cancelText}
          </Button>
          <Button
            onClick={() => {
              dialogProps.onConfirm();
              setDialogOpen(false);
            }}
            color="primary"
          >
            {dialogProps.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </SnackbarDialogContext.Provider>
  );
};

/* ---------------------------------------------
 *  Hook 导出
 * --------------------------------------------- */
export const useSnackbarDialog = () => {
  const ctx = React.useContext(SnackbarDialogContext);
  if (!ctx) throw new Error("useSnackbarDialog 必须在 Provider 内使用");
  return ctx;
};
