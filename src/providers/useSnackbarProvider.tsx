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
} from "@mui/material";
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
  }: {
    message: string;
    title?: string;
    type?: "success" | "error" | "info" | "warning";
    duration?: number;
  }) => {
    const id = snackbarId;
    setSnackbarId((s) => s + 1);

    const newSnackbar: SnackbarState = {
      open: true,
      message,
      title,
      type,
      duration,
      vertical: "top",
      horizontal: "center",
      transition: Fade,
      id,
      remainingTime: duration,
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
