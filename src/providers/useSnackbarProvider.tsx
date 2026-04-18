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
import { TransitionProps } from "@mui/material/transitions";
import { SnackbarOrigin } from "@mui/material/Snackbar";
import { styled } from "@mui/material";

/* ---------------------------------------------
 *  自定义 Styled Snackbar
 * --------------------------------------------- */
interface StyledSnackbarProps {
  type: "success" | "error" | "info" | "warning";
}

const Snackbar = styled(MUI_Snackbar)<StyledSnackbarProps>`
  color: var(--key--color_inside-accent) !important;

  background-color: ${({ type }) =>
    type === "success"
      ? "#67c23a"
      : type === "error"
      ? "#f56c6c"
      : type === "warning"
      ? "#e6a23c"
      : "var(--key--color_accent)"} !important;

  border-radius: 0.625rem;

  & > .MuiPaper-root {
    color: var(--key--color_inside-accent) !important;
    background-color: ${({ type }) =>
      type === "success"
        ? "#67c23a"
        : type === "error"
        ? "#f56c6c"
        : type === "warning"
        ? "#e6a23c"
        : "var(--key--color_accent)"} !important;
    border-radius: 0.625rem;
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
  transition: React.ComponentType<TransitionProps>;
  id: number;
  remainingTime: number;
  /** 右上角深色卡片（设备发现 / 已连接） */
  presentation?: "default" | "deviceCard";
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
    presentation?: "default" | "deviceCard";
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

function DeviceCardToast({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  /** 对齐第二张参考图：深灰底、约 10px 圆角、绿圈 + 深色勾、右上浅灰关闭 */
  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        minWidth: { xs: 268, sm: 300 },
        maxWidth: 420,
        py: "10px",
        pl: "12px",
        pr: "32px",
        borderRadius: "10px",
        bgcolor: "#212121",
        color: "#fff",
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
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
          color: "rgba(255,255,255,0.38)",
          "&:hover": {
            color: "rgba(255,255,255,0.75)",
            bgcolor: "rgba(255,255,255,0.06)",
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
          pr: 0.5,
        }}
      >
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
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
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
        <Typography
          component="div"
          sx={{
            fontSize: "0.75rem",
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.62)",
            fontWeight: 400,
            pl: "28px",
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
    presentation?: "default" | "deviceCard";
  }) => {
    const id = snackbarId;
    setSnackbarId((s) => s + 1);

    const isCard = presentation === "deviceCard";

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

        if (sn.presentation === "deviceCard") {
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
              <div style={{ display: "flex", flexDirection: "column" }}>
                {sn.title && (
                  <span style={{ fontWeight: 700, marginBottom: 2 }}>{sn.title}</span>
                )}
                <span>{sn.message}</span>
              </div>
            }
            autoHideDuration={sn.duration}
            onClose={(event, reason) => handleClose(sn.id, reason as string)}
            TransitionComponent={sn.transition}
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
      <Dialog open={dialogOpen} onClose={() => dialogProps.onCancel()}>
        <DialogTitle>{dialogProps.title}</DialogTitle>
        <DialogContent>
          <p>{dialogProps.content}</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => dialogProps.onCancel()} color="secondary">
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
