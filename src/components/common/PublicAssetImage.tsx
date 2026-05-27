'use client';

import { Box, type BoxProps } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { getPublicAssetUrlCandidates } from '@/utils/resolvePublicAssetUrl';

type PublicAssetImageProps = Omit<BoxProps, 'src' | 'component' | 'alt'> & {
  src: string;
  alt?: string;
};

/** 兼容 `assetPrefix: "./"` 的 `<img>`：自动解析相对路径，失败时依次尝试候选 URL。 */
export default function PublicAssetImage({ src, alt = '', sx, ...rest }: PublicAssetImageProps) {
  const candidates = useMemo(() => getPublicAssetUrlCandidates(src), [src]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [src]);

  const resolvedSrc = candidates[Math.min(candidateIndex, candidates.length - 1)] ?? src;

  return (
    <Box
      component="img"
      src={resolvedSrc}
      alt={alt}
      decoding="async"
      onError={() => {
        setCandidateIndex((i) => (i + 1 < candidates.length ? i + 1 : i));
      }}
      sx={sx}
      {...rest}
    />
  );
}
