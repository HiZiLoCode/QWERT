"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

type Props = {
  open: boolean;
  title: string;
  content: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ScreenThemeConfirmDialog({
  open,
  title,
  content,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
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
      <DialogActions sx={{ px: 16, pb: 16, pt: 5, gap: 10 }}>
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

