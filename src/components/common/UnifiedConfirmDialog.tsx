"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

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
    >
      <DialogTitle
        sx={{
          pb: 10,
          fontSize: "1rem",
          fontWeight: 600,
          color: "#0f172a",
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ pt: "0.375rem !important" }}>
        <Typography
          sx={{
            fontSize: "0.9375rem",
            color: "#334155",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {content}
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{
          px: 16,
          pb: 16,
          pt: 5,
          gap: 10,
          justifyContent: confirmOnly ? "flex-end" : undefined,
        }}
      >
        {!confirmOnly ? (
          <Button
            onClick={onCancel}
            color="inherit"
            sx={{
              minWidth: "5rem",
              textTransform: "none",
              borderRadius: "0.625rem",
            }}
          >
            {cancelText}
          </Button>
        ) : null}
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            minWidth: "5rem",
            textTransform: "none",
            borderRadius: "0.625rem",
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
