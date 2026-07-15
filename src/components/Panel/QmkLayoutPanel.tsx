'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { ButtonRem } from '@/styled/ReconstructionRem';
import { useTranslation } from '@/app/i18n';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';
import { getSettingsRowTitleSx } from '@/constants/settingsPanelTypography';
import { lightingPanelCardSx } from '@/constants/lightingPanelChrome';
import { getComfortableScrollbarSx } from '@/utils/comfortableScrollbarSx';
import {
  deleteDefinition,
  getStoredDefinitions,
  readDefinitionFile,
  saveDefinition,
  type StoredDefinition,
} from '@/utils/definition-storage';

function formatVidPidHex(vendorId: string, productId: string): string {
  const vid = parseInt(vendorId, 16);
  const pid = parseInt(productId, 16);
  if (Number.isNaN(vid) || Number.isNaN(pid)) return `${vendorId}${productId}`;
  return `0x${vid.toString(16).toUpperCase().padStart(4, '0')}${pid.toString(16).toUpperCase().padStart(4, '0')}`;
}

export default function QmkLayoutPanel() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation('common');
  const { showMessage, showDialog } = useSnackbarDialog();
  const [definitions, setDefinitions] = useState<StoredDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getStoredDefinitions();
      list.sort((a, b) => b.uploadTime - a.uploadTime);
      setDefinitions(list);
    } catch (error) {
      console.error('[QmkLayout] 加载布局列表失败:', error);
      setDefinitions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadOutlineBtnSx = useMemo(
    () => ({
      textTransform: 'none' as const,
      minWidth: '88px',
      height: '36px',
      px: '20px',
      fontSize: '14px',
      fontWeight: 500,
      borderRadius: '8px',
      boxShadow: 'none',
      ...(isDark
        ? {
            color: alpha(theme.palette.common.white, 0.78),
            bgcolor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              borderColor: alpha(theme.palette.primary.main, 0.5),
            },
          }
        : {
            color: '#64748b',
            bgcolor: 'rgba(255, 255, 255, 1)',
            border: '1px solid rgba(148, 163, 184, 0.55)',
            '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
          }),
    }),
    [isDark, theme],
  );

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (files.length === 0) return;

      setUploading(true);
      const failed: string[] = [];
      let successCount = 0;

      for (const file of files) {
        try {
          const definition = await readDefinitionFile(file);
          await saveDefinition(definition);
          successCount += 1;
        } catch (error) {
          failed.push(`${file.name}: ${error instanceof Error ? error.message : '保存失败'}`);
        }
      }

      await reload();
      setUploading(false);

      if (successCount > 0) {
        showMessage({ message: t('2879'), type: 'success' });
      }
      if (failed.length > 0) {
        showMessage({
          message: failed.join('\n'),
          type: 'warning',
        });
      }
    };
    input.click();
  };

  const performDelete = async (item: StoredDefinition) => {
    try {
      await deleteDefinition(item.id);
      await reload();
      showMessage({ message: t('2880'), type: 'success' });
    } catch (error) {
      console.error('[QmkLayout] 删除失败:', error);
      showMessage({
        message: error instanceof Error ? error.message : 'Delete failed',
        type: 'error',
      });
    }
  };

  const handleDelete = (item: StoredDefinition) => {
    showDialog({
      title: t('712'),
      content: t('2878'),
      confirmText: t('1111'),
      cancelText: t('714'),
      onConfirm: () => {
        void performDelete(item);
      },
      onCancel: () => {},
    });
  };

  const rowTextColor = isDark ? alpha(theme.palette.common.white, 0.82) : '#475569';
  const rowIdColor = isDark ? alpha('#e8b88a', 0.95) : '#64748b';
  const dividerColor = isDark ? alpha(theme.palette.common.white, 0.12) : 'rgba(148, 163, 184, 0.35)';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, height: '100%' }}>
      <Box
        sx={{
          ...lightingPanelCardSx(theme),
          borderRadius: '12px',
          px: '20px',
          py: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <Typography sx={getSettingsRowTitleSx(theme)}>{t('2876')}</Typography>
        <ButtonRem
          variant="outlined"
          onClick={handleUpload}
          disabled={uploading}
          sx={loadOutlineBtnSx}
        >
          {t('2877')}
        </ButtonRem>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          borderRadius: '12px',
          overflow: 'auto',
          ...getComfortableScrollbarSx(isDark),
        }}
      >
        {loading ? (
          <Typography sx={{ color: rowTextColor, fontSize: '14px', py: '24px', textAlign: 'center' }}>
            …
          </Typography>
        ) : definitions.length === 0 ? (
          <Typography sx={{ color: rowTextColor, fontSize: '14px', py: '24px', textAlign: 'center' }}>
            {t('2724')}
          </Typography>
        ) : (
          definitions.map((item) => {
            const { vendorId, productId } = item.definition;
            return (
              <Box
                key={item.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  py: '18px',
                  borderBottom: `1px solid ${dividerColor}`,
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Typography
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '16px',
                    fontWeight: 500,
                    color: rowTextColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.name}
                </Typography>
                <Typography
                  sx={{
                    flexShrink: 0,
                    fontSize: '15px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    color: rowIdColor,
                    letterSpacing: '0.02em',
                  }}
                >
                  {formatVidPidHex(vendorId, productId)}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(item)}
                  aria-label={t('2878')}
                  sx={{
                    flexShrink: 0,
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: `1px solid ${dividerColor}`,
                    color: rowIdColor,
                    '&:hover': {
                      bgcolor: isDark ? alpha(theme.palette.error.main, 0.12) : 'rgba(239, 68, 68, 0.08)',
                      borderColor: alpha(theme.palette.error.main, 0.45),
                      color: theme.palette.error.main,
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: '18px' }} />
                </IconButton>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
