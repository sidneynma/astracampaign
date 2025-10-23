import { useEffect } from 'react';
import { useSettings } from './useSettings';

export const usePageMeta = () => {
  const { settings } = useSettings();

  useEffect(() => {
    // Atualizar título da página
    if (settings?.pageTitle) {
      document.title = settings.pageTitle;
    }

    // Atualizar favicon
    if (settings?.faviconUrl) {
      // Remover favicon existente
      const existingFavicon = document.querySelector('link[rel="icon"]') ||
                             document.querySelector('link[rel="shortcut icon"]');
      if (existingFavicon) {
        existingFavicon.remove();
      }

      // Adicionar novo favicon
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/png';
      favicon.href = settings.faviconUrl;
      document.head.appendChild(favicon);
    }
  }, [settings?.pageTitle, settings?.faviconUrl]);
};