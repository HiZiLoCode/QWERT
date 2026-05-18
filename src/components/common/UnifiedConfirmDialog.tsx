"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

export type UnifiedConfirmDialogProps = {
  open: boolean;
  title: string;
  content: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 仅显示确认；禁止 ESC、点遮罩关闭（只能点确认） */
  confirmOnly?: boolean;
};

/** 应用内统一确认弹窗（标题 + 正文 + 取消 / 主按钮确认） */
export default function UnifiedConfirmDialog({
  open,
  title,
  content,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  confirmOnly = false,
}: UnifiedConfirmDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const handleDialogClose = (
    _event: unknown,
    reason: "backdropClick" | "escapeKeyDown" | "closeClick"
  ) => {
    if (
      confirmOnly &&
      (reason === "backdropClick" || reason === "escapeKeyDown")
    ) {
      return;
    }
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      disableEscapeKeyDown={confirmOnly}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "14px",
          bgcolor: theme.palette.background.paper,
          ...(isDark
            ? {
                border: `1px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
              }
            : {
                border: "1px solid rgba(15, 23, 42, 0.08)",
                boxShadow: "0 16px 40px rgba(15, 23, 42, 0.1)",
              }),
        },
      }}
    >
      <DialogTitle
        sx={{
          pt: '20px',
          px: '24px',
          pb: '8px',
          fontSize: '18px',
          fontWeight: 700,
          lineHeight: 1.4,
          color: isDark ? alpha(theme.palette.common.white, 0.92) : '#0f172a',
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ pt: '4px !important', px: '24px !important', pb: '8px !important' }}>
        <Typography
          sx={{
            fontSize: '15px',
            color: isDark ? alpha(theme.palette.common.white, 0.72) : '#334155',
            lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
          }}
        >
          {content}
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{
          px: '24px',
          pb: '20px',
          pt: '12px',
          gap: 10,
          justifyContent: confirmOnly ? 'flex-end' : undefined,
        }}
      >
        {!confirmOnly ? (
          <Button
            onClick={onCancel}
            color="inherit"
            sx={{
              minWidth: '88px',
              textTransform: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 500,
              ...(isDark
                ? {
                    color: alpha(theme.palette.common.white, 0.75),
                    border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
                  }
                : {}),
            }}
          >
            {cancelText}
          </Button>
        ) : null}
        <Button
          onClick={onConfirm}
          variant="contained"
          color="primary"
          sx={{
            minWidth: '96px',
            px: '20px',
            py: '9px',
            textTransform: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
