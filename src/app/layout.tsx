import type { Metadata } from 'next';
import './globals.css';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import ThemeContextProvider from "@/providers/ThemeContextProvider";
export const metadata: Metadata = {
  title: 'QK100',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>
        <AppRouterCacheProvider>
          <ThemeContextProvider>
            {children}
          </ThemeContextProvider></AppRouterCacheProvider>
      </body>
    </html>
  );
}







