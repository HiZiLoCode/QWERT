'use client';

import { useState, useEffect } from "react";
import { Box, Typography, Paper, List, ListItem, ListItemText } from "@mui/material";

function BindTest() {
  const [testDownKeys, setTestDownKeys] = useState<string[]>([]);
  const [testUpKeys, setTestUpKeys] = useState<string[]>([]);

  const delDownKey = () => {
    setTestDownKeys((keys) => {
      const newKeys = keys.slice(0, -1);
      return [...newKeys];
    });
  };

  const testKeyDownEvent = (event: KeyboardEvent) => {
    setTestDownKeys((keys) => {
      return [event.key, ...keys];
    });
    setTimeout(delDownKey, 4000);
  };

  const delUpKey = () => {
    setTestUpKeys((keys) => {
      const newKeys = keys.slice(0, -1);
      return [...newKeys];
    });
  };

  const testKeyUpEvent = (event: KeyboardEvent) => {
    setTestUpKeys((keys) => {
      return [event.key, ...keys];
    });
    setTimeout(delUpKey, 4000);
  };

  useEffect(() => {
    document.addEventListener("keydown", testKeyDownEvent);
    document.addEventListener("keyup", testKeyUpEvent);
    return () => {
      document.removeEventListener("keydown", testKeyDownEvent);
      document.removeEventListener("keyup", testKeyUpEvent);
    };
  }, []);

  return (
    <Box pt={4}>
      <Box display="flex" gap={2} mb={4}>
        <Typography variant="body2" sx={{ width: 80 }}>
          按下测试
        </Typography>
        <Paper variant="outlined" sx={{ width: "100%", height: 128, overflowY: "auto", p: 2 }}>
          <List sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {testDownKeys.map((key, index) => (
              <ListItem
                key={index}
                sx={{
                  backgroundColor: "background.paper",
                  border: 1,
                  fontSize: "1.25rem",
                  fontWeight: "medium",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                }}
              >
                <ListItemText primary={key} primaryTypographyProps={{ textAlign: "center" }} />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Box>
      <Box display="flex" gap={2}>
        <Typography variant="body2" sx={{ width: 80 }}>
          释放测试
        </Typography>
        <Paper variant="outlined" sx={{ width: "100%", height: 128, overflowY: "auto", p: 2 }}>
          <List sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {testUpKeys.map((key, index) => (
              <ListItem
                key={index}
                sx={{
                  backgroundColor: "background.paper",
                  border: 1,
                  fontSize: "1.25rem",
                  fontWeight: "medium",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                }}
              >
                <ListItemText primary={key} primaryTypographyProps={{ textAlign: "center" }} />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Box>
    </Box>
  );
}

export default BindTest;
