//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'moss-triage-theme';

function prefersDark(): boolean {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function storedTheme(): boolean | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'basement') return true;
    if (stored === 'office') return false;
  } catch {
    return undefined;
  }
  return undefined;
}

export function useAppTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = storedTheme();
    return saved ?? prefersDark();
  });

  useEffect(() => {
    document.documentElement.dataset.mossTheme = isDark ? 'basement' : 'office';
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    if (storedTheme() !== undefined || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event: MediaQueryListEvent) => setIsDark(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [isDark]);

  const toggleTheme = () => {
    const next = !isDark;
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'basement' : 'office');
    } catch {
      // The current page still changes theme when storage is unavailable.
    }
    setIsDark(next);
  };

  return { isDark, toggleTheme };
}
