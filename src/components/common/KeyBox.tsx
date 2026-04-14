"use client";

import React from "react";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

function KeyBox({ keyCode, onDrop, size = 12 }) {
  const theme = useTheme(); // 获取主题对象

  const drop = (evt) => {
    evt.preventDefault();
    const keycode = JSON.parse(evt.dataTransfer.getData("keyCode"));
    onDrop && onDrop(keycode);
  };

  const dragOver = (evt) => {
    evt.preventDefault();
  };

  return (
    <Box
      onDrop={drop}
      onDragOver={dragOver}
      sx={{
        position: "relative",
        width: `${size * 4}px`,
        height: `${size * 4}px`,
        border: `0.0625rem solid ${theme.palette.divider}`,
        borderRadius: 1,
        backgroundColor: theme.palette.background.paper,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* 删除按钮 */}
      {keyCode !== "" && (
        <IconButton
          size="small"
          sx={{
            position: "absolute",
            top: -14,
            right: -14,
            transform: 'scale(0.6)',
            color: theme.palette.error.main,
            backgroundColor: theme.palette.error.light,
            opacity: 0,
            transition: "opacity 0.3s",
            "&:hover": {
              backgroundColor: theme.palette.error.light,
              opacity: 1,
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}

      {/* 显示的按键内容 */}
      <Typography
        variant="body2"
        fontWeight="bold"
        color="text.primary"
        textAlign="center"
      >
        {keyCode}
      </Typography>
    </Box>
  );
}

export default KeyBox;
