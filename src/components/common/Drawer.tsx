import { Box, Typography, Button } from "@mui/material";

export default function Drawer({ title, open, setOpen, onSave, children, collapsed }: {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => void;
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  return (
    <Box
      borderRight="0.125rem"
      borderColor={"divider"}
      sx={{
        position: "absolute",
        width: collapsed ? "calc(100vw - 80px)" : "calc(100vw - 180px)",
        height: "100%",
        zIndex: 50,
        top: 0,
        left: 0,
        bgcolor: "background.paper", // 使用主题中的颜色
        boxShadow: 3,
        transform: open ? "translateY(0)" : "translateY(100%)",
        opacity: open ? 1 : 0,
        transition: "transform 0.3s ease-in-out, opacity 0.3s ease-in-out",
      }}
    >
      {/* Header Section */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 2,
          pr: 6,
          pl: 3,
          borderBottom: 1,
          borderColor: "customed3.main", // 使用主题中的颜色
        }}
      >
        <Typography variant="h6" fontWeight="bold" color="black.main">
          {title}
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            sx={{
              color: "error.main",
              borderColor: "error.main",
              "&:hover": {
                backgroundColor: "error.light",
                borderColor: "error.main",
              },
            }}
            onClick={() => setOpen(false)}
          >
            取消
          </Button>
          <Button
            variant="contained"
            sx={{
              backgroundColor: "primary.main",
              "&:hover": {
                backgroundColor: "primary.dark",
              },
            }}
            onClick={onSave}
          >
            保存
          </Button>
        </Box>
      </Box>

      {/* Content Section */}
      <Box sx={{ flex: 1, overflow: "auto", p: 3, bgcolor: "background.paper" }}>
        {children}
      </Box>
    </Box>
  );
}
