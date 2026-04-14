'use client';

import { Button, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLocale = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLocale);
  };

  return (
    <Box>
      <Button
        variant="outlined"
        size="small"
        onClick={toggleLanguage}
        sx={{ minWidth: '5rem' }}
      >
        {i18n.language === 'zh' ? 'English' : '中文'}
      </Button>
    </Box>
  );
}
