import { Box, Typography, LinearProgress, Backdrop, Paper } from "@mui/material";
import { useEffect, useContext } from "react";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";
import { useTranslation } from "@/app/i18n";
import { useSnackbarDialog } from "@/providers/useSnackbarProvider";

export default function ResetProgress({
  onComplete
}: any) {
  const { resetProgress } = useContext(ConnectKbContext);
  const { t } = useTranslation("common");
  const { showMessage } = useSnackbarDialog();

  const handleUpdate = () => {
    onComplete(false);
    showMessage({
      type: 'success',
      message: t("790")
    });
  };

  useEffect(() => {
    if (resetProgress >= 100) {
      const timer = setTimeout(() => {
        handleUpdate();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [resetProgress]);

  return (
    <Backdrop
      open={true}
      sx={{
        zIndex: 10000,
        backgroundColor: 'rgba(12, 33, 63, 0.3)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <Paper
        sx={{
          width: '260px',
          p: '16px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <Typography
          sx={{
            color: '#1a1a1a',
            fontWeight: 'bold',
            mb: '8px',
            fontSize: '14px'
          }}
        >
          {t("791")}
        </Typography>
        <Typography
          sx={{
            textAlign: 'center',
            color: '#5f7089',
            fontSize: '13px',
            mb: '8px'
          }}
        >
          {t("792")} {resetProgress}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={resetProgress}
          sx={{
            height: 8,
            borderRadius: 5,
            bgcolor: 'rgba(59, 130, 246, 0.1)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 5,
              bgcolor: '#3B82F6',
            },
          }}
        />
      </Paper>
    </Backdrop>
  );
}
