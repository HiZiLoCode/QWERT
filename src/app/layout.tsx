import type { Metadata } from 'next';
import './globals.css';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import ThemeContextProvider from "@/providers/ThemeContextProvider";
import { getRemBootstrapOneShotInlineScript } from '@/utils/rem';
export const metadata: Metadata = {
  title: 'QK 100 Mk2',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: getRemBootstrapOneShotInlineScript() }}
        />
      </head>
      <body>
        <AppRouterCacheProvider>
          <ThemeContextProvider>
            {children}
          </ThemeContextProvider></AppRouterCacheProvider>
      </body>
    </html>
  );
}







