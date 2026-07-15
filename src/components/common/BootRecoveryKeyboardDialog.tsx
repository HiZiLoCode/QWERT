"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Modal,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { alpha, useTheme } from "@mui/material/styles";
import { useTranslation } from "@/app/i18n";
import type { BootRecoveryKeyboardOption } from "@/utils/bootRecoveryKeyboardOptions";
import {
  getFirmwareReleasesForDevice,
  pickFirmwareReleaseChanges,
  type FirmwareRelease,
} from "@/config/firmwareChangelog";
import { settingsFirmwareCardSx } from "@/constants/lightingPanelChrome";
import { hasFirmwareFilePath } from "@/utils/firmwareUpgradeReadiness";

const MODAL_WIDTH = 720;
const MODAL_HEIGHT = 720;
/** Modal 为 14000，下拉层必须更高才能显示在遮罩之上 */
const MODAL_MENU_Z_INDEX = 14001;

type BootRecoveryKeyboardDialogProps = {
  open: boolean;
  options: BootRecoveryKeyboardOption[];
  onCancel: () => void;
  onConfirm: (option: BootRecoveryKeyboardOption) => void;
};

type InstallableRelease = FirmwareRelease & { firmwareFile: string };

function getInstallableReleases(device: BootRecoveryKeyboardOption | null): InstallableRelease[] {
  if (!device) return [];

  const fromChangelog = getFirmwareReleasesForDevice(
    device.vendorId,
    device.productId,
    device.devMode,
  ).filter((release): release is InstallableRelease => hasFirmwareFilePath(release.firmwareFile));

  if (fromChangelog.length > 0) return fromChangelog;

  if (hasFirmwareFilePath(device.updateFile)) {
    return [
      {
        version: device.upgradeVersion,
        date: "",
        firmwareFile: device.updateFile,
        changes: { zh: [], en: [], "zh-Hant": [], ja: [], ko: [], ru: [] },
      },
    ];
  }

  return [];
}

function VersionReleaseCard({
  deviceName,
  release,
  isLatest,
  expanded,
  onToggleExpand,
  onInstall,
  lang,
}: {
  deviceName: string;
  release: InstallableRelease;
  isLatest: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onInstall: () => void;
  lang: string;
}) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const primary = theme.palette.primary.main;
  const changes = pickFirmwareReleaseChanges(release.changes, lang);
  const cardSx = settingsFirmwareCardSx(theme);

  return (
    <Box sx={{ ...cardSx, py: "14px !important", px: "16px !important" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: "wrap", minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "15px",
              fontWeight: 600,
              color: "text.primary",
              lineHeight: 1.4,
            }}
          >
            {deviceName} V{release.version}
          </Typography>
          {isLatest ? (
            <Chip
              label={t("2993")}
              size="small"
              sx={{
                height: 20,
                fontSize: "11px",
                fontWeight: 700,
                bgcolor: primary,
                color: theme.palette.primary.contrastText,
                "& .MuiChip-label": { px: "8px" },
              }}
            />
          ) : null}
        </Stack>

        <Button
          variant="contained"
          color="primary"
          onClick={onInstall}
          sx={{
            flexShrink: 0,
            minWidth: 64,
            height: 32,
            px: "14px",
            textTransform: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
          }}
        >
          {t("2994")}
        </Button>
      </Box>

      <Box
        component="button"
        type="button"
        onClick={onToggleExpand}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          mt: "10px",
          mb: expanded ? "8px" : 0,
          p: 0,
          border: "none",
          bgcolor: "transparent",
          cursor: "pointer",
        }}
      >
        <Typography sx={{ fontSize: "13px", color: "text.secondary" }}>
          {t("2990")}
        </Typography>
        <Typography sx={{ fontSize: "13px", color: isDark ? alpha(primary, 0.85) : primary }}>
          {expanded ? t("2991") : t("2992")}
        </Typography>
      </Box>

      <Collapse in={expanded}>
        {changes.length > 0 ? (
          <Box
            component="ul"
            sx={{
              m: 0,
              pl: "18px",
              color: "text.secondary",
              fontSize: "13px",
              lineHeight: 1.75,
              "& li": { mb: "2px" },
            }}
          >
            {changes.map((line, index) => (
              <li key={`${release.version}-${index}`}>{line}</li>
            ))}
          </Box>
        ) : (
          <Typography sx={{ fontSize: "13px", color: "text.disabled", lineHeight: 1.65 }}>
            {t("2526")}
          </Typography>
        )}
      </Collapse>
    </Box>
  );
}

export default function BootRecoveryKeyboardDialog({
  open,
  options,
  onCancel,
  onConfirm,
}: BootRecoveryKeyboardDialogProps) {
  const { t, i18n } = useTranslation("common");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const primary = theme.palette.primary.main;
  const lang = i18n.resolvedLanguage ?? i18n.language ?? "zh";

  const [selectedDevice, setSelectedDevice] = useState<BootRecoveryKeyboardOption | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});

  const installableReleases = useMemo(
    () => getInstallableReleases(selectedDevice),
    [selectedDevice],
  );

  useEffect(() => {
    if (!open) {
      setSelectedDevice(null);
      setExpandedVersions({});
      return;
    }
    if (options.length > 0) {
      setSelectedDevice(options[0]);
    }
  }, [open, options]);

  useEffect(() => {
    if (!installableReleases.length) {
      setExpandedVersions({});
      return;
    }
    setExpandedVersions({ [installableReleases[0].version]: true });
  }, [selectedDevice?.key, installableReleases]);

  const handleClose = () => {
    setSelectedDevice(null);
    setExpandedVersions({});
    onCancel();
  };

  const handleInstall = (release: InstallableRelease) => {
    if (!selectedDevice) return;
    onConfirm({
      ...selectedDevice,
      updateFile: release.firmwareFile,
      upgradeVersion: release.version,
    });
    setSelectedDevice(null);
    setExpandedVersions({});
  };

  const deviceAutocompleteSx = {
    "& .MuiOutlinedInput-root": {
      height: 40,
      borderRadius: "8px",
      bgcolor: isDark ? alpha(theme.palette.common.white, 0.04) : "#f8fafc",
      fontSize: "14px",
      "& fieldset": {
        borderColor: isDark ? alpha(primary, 0.35) : "rgba(15, 23, 42, 0.12)",
      },
      "&:hover fieldset": {
        borderColor: alpha(primary, 0.55),
      },
      "&.Mui-focused fieldset": {
        borderColor: primary,
      },
    },
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      sx={{
        zIndex: 14000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: MODAL_WIDTH,
          height: MODAL_HEIGHT,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 32px)",
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${isDark ? alpha(primary, 0.48) : "rgba(15, 23, 42, 0.08)"}`,
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: isDark
            ? "0 24px 64px rgba(0,0,0,0.55)"
            : "0 20px 48px rgba(15, 23, 42, 0.12)",
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            px: "24px",
            pt: "20px",
            pb: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography
            sx={{
              fontSize: "18px",
              fontWeight: 700,
              color: "text.primary",
              lineHeight: 1.3,
            }}
          >
            {t("2995")}
          </Typography>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{
              color: "text.secondary",
              "&:hover": {
                bgcolor: isDark ? alpha(theme.palette.common.white, 0.08) : "rgba(15, 23, 42, 0.06)",
              },
            }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        <Box sx={{ flexShrink: 0, px: "24px", pb: "16px" }}>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              color: "text.secondary",
              mb: "8px",
            }}
          >
            {t("2989")}
          </Typography>

          <Autocomplete
            options={options}
            value={selectedDevice}
            onChange={(_, value) => setSelectedDevice(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(a, b) => a.key === b.key}
            noOptionsText={t("2985")}
            openOnFocus
            disableClearable={Boolean(selectedDevice)}
            filterOptions={(opts, state) => {
              const query = state.inputValue.trim().toLowerCase();
              if (!query) return opts;
              return opts.filter(
                (option) =>
                  option.name.toLowerCase().includes(query) ||
                  option.key.toLowerCase().includes(query),
              );
            }}
            slotProps={{
              popper: {
                sx: { zIndex: MODAL_MENU_Z_INDEX },
                placement: "bottom-start",
              },
              paper: {
                sx: {
                  mt: 0.5,
                  bgcolor: theme.palette.background.paper,
                  border: `1px solid ${isDark ? alpha(primary, 0.35) : "rgba(15, 23, 42, 0.1)"}`,
                  borderRadius: "8px",
                  boxShadow: isDark
                    ? "0 12px 32px rgba(0,0,0,0.45)"
                    : "0 8px 24px rgba(15, 23, 42, 0.12)",
                },
              },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t("2984")}
                size="small"
                sx={deviceAutocompleteSx}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...rest } = props;
              return (
                <Box
                  component="li"
                  key={option.key}
                  {...rest}
                  sx={{
                    fontSize: "14px",
                    py: "8px !important",
                    "&.Mui-focused": {
                      bgcolor: `${alpha(primary, 0.12)} !important`,
                    },
                    '&[aria-selected="true"]': {
                      bgcolor: `${alpha(primary, 0.12)} !important`,
                    },
                  }}
                >
                  {option.name}
                </Box>
              );
            }}
          />
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            px: "24px",
            pb: "24px",
            overflowY: "auto",
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-thumb": {
              borderRadius: 999,
              bgcolor: isDark ? alpha(theme.palette.common.white, 0.18) : "rgba(15, 23, 42, 0.18)",
            },
          }}
        >
          {!selectedDevice ? (
            <Box
              sx={{
                ...settingsFirmwareCardSx(theme),
                height: "100%",
                minHeight: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography sx={{ fontSize: "14px", color: "text.disabled" }}>
                {t("2983")}
              </Typography>
            </Box>
          ) : installableReleases.length === 0 ? (
            <Box
              sx={{
                ...settingsFirmwareCardSx(theme),
                height: "100%",
                minHeight: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography sx={{ fontSize: "14px", color: "text.disabled" }}>
                {t("2985")}
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {installableReleases.map((release, index) => (
                <VersionReleaseCard
                  key={`${release.version}-${release.date}`}
                  deviceName={selectedDevice.name}
                  release={release}
                  isLatest={index === 0}
                  expanded={Boolean(expandedVersions[release.version])}
                  onToggleExpand={() =>
                    setExpandedVersions((prev) => ({
                      ...prev,
                      [release.version]: !prev[release.version],
                    }))
                  }
                  onInstall={() => handleInstall(release)}
                  lang={lang}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Paper>
    </Modal>
  );
}
