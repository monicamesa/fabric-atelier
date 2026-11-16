import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAppTheme } from './use-theme';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-moss-theme');
  vi.unstubAllGlobals();
});

function installMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches,
    addEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  return {
    media,
    change(matchesNow: boolean) {
      media.matches = matchesNow;
      for (const listener of listeners) listener({ matches: matchesNow } as MediaQueryListEvent);
    },
  };
}

describe('app theme', () => {
  it('uses the system preference when there is no saved choice', () => {
    const system = installMedia(true);
    const { result } = renderHook(useAppTheme);

    expect(result.current.isDark).toBe(true);
    expect(document.documentElement).toHaveAttribute('data-moss-theme', 'basement');
    expect(system.media.addEventListener).toHaveBeenCalledOnce();
  });

  it('follows system changes until the user chooses a theme', async () => {
    const system = installMedia(false);
    const { result } = renderHook(useAppTheme);
    await act(async () => system.change(true));
    expect(result.current.isDark).toBe(true);

    await act(async () => result.current.toggleTheme());
    expect(result.current.isDark).toBe(false);
    expect(localStorage.getItem('moss-triage-theme')).toBe('office');
    await act(async () => system.change(true));
    expect(result.current.isDark).toBe(false);
  });

  it('restores a saved theme instead of the current system preference', () => {
    localStorage.setItem('moss-triage-theme', 'basement');
    const system = installMedia(false);
    const { result } = renderHook(useAppTheme);

    expect(result.current.isDark).toBe(true);
    expect(system.media.addEventListener).not.toHaveBeenCalled();
  });

  it('persists theme changes between visits', async () => {
    installMedia(true);
    const { result } = renderHook(useAppTheme);
    await act(async () => result.current.toggleTheme());

    expect(result.current.isDark).toBe(false);
    expect(document.documentElement).toHaveAttribute('data-moss-theme', 'office');
    expect(localStorage.getItem('moss-triage-theme')).toBe('office');
  });
});
