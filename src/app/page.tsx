'use client';


import Content from '@/ui/Content';
import ConnectKbProvider, { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { useContext, useEffect, useLayoutEffect } from 'react';

/** 避免 SSR 对 useLayoutEffect 的告警；客户端用 layout 以便在绘制前设好 rem */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
import EditorProvider from '@/providers/EditorProvider';
import ProfileProvider from '@/providers/ProfileProvider';
import { SnackbarDialogProvider } from '@/providers/useSnackbarProvider';
import MainProvider from '@/providers/MainProvider';
import LayoutProvider from '@/providers/LayoutProvider';
import { setRemBase } from '@/utils/rem';

function AppContent() {
  const { loading } = useContext(ConnectKbContext);
  return (
    <section className={`w-full h-full ${loading ? 'min-w-[80rem]' : 'min-w-[33.75rem]'} overflow-hidden`}>
      <Content />
    </section>
  );
}
export default function Home() {
  useIsoLayoutEffect(() => {
    const teardown = setRemBase(window.screen.width);
    return () => teardown?.();
  }, []);
  return (
    <SnackbarDialogProvider>
      <ConnectKbProvider>
        <EditorProvider>
          <ProfileProvider>
            <MainProvider>
              <LayoutProvider>
                <AppContent />
              </LayoutProvider>
            </MainProvider>
          </ProfileProvider>
        </EditorProvider>
      </ConnectKbProvider>
    </SnackbarDialogProvider>
  );
}








