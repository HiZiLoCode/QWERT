import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  zh: {
    common: {
      welcome: '欢迎',
      description: '这是一个 Next.js + MUI + i18next 项目',
      getStarted: '开始使用',
      learnMore: '了解更多',
      features: '功能特性',
    },
  },
  en: {
    common: {
      welcome: 'Welcome',
      description: 'This is a Next.js + MUI + i18next project',
      getStarted: 'Get Started',
      learnMore: 'Learn More',
      features: 'Features',
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh',
    fallbackLng: 'zh',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

