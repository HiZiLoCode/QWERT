'use client';


import Content from '@/ui/Content';
import ConnectKbProvider, { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { useContext, useEffect } from 'react';
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
  useEffect(() => {
    const screenWidth = window.screen.width;
    setRemBase(screenWidth);
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








