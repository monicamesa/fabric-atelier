//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactElement } from 'react';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { ErrorBoundary } from "react-error-boundary";
import { useCssTheme } from "@microsoft/fabric-visuals";

import App from './App.tsx';
import { ErrorFallback } from './ErrorFallback';
import { useAppTheme } from './hooks/use-theme';
import { ThemeContext } from './hooks/theme.context';
import { AuthProvider } from './hooks/use-auth';
import { bootstrapAuth, type IAuthService } from './services/rayfin-auth.service';
import { bootstrapLanguage } from './services/language.service';
import { AuthGate } from './components/auth-gate.component';
import { LaunchClockProvider } from './launch/launch-clock';
import { initI18n } from './i18n/i18n';
import { applyThemeAtStart } from './hooks/initial-theme';

// Bundled fonts (design guide, section 3); no runtime requests to Google Fonts.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/500.css';
import "./global.css"
import "./styles/docket-tokens.css"

initI18n();
applyThemeAtStart();
const rayfinAuthService: IAuthService = bootstrapAuth();

function Root(): ReactElement {
    const { isDark, toggleTheme } = useAppTheme();
    const theme = useCssTheme();

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <LaunchClockProvider>
                    <AuthProvider rayfinAuthService={rayfinAuthService}>
                        <AuthGate>
                            <App />
                        </AuthGate>
                    </AuthProvider>
                </LaunchClockProvider>
            </ErrorBoundary>
        </ThemeContext.Provider>
    );
}

const root: ReactRoot = createRoot(document.getElementById('root')!);

root.render(<Root />);

void bootstrapLanguage().then(() => {
    // Reconcile the existing tree with the loaded strings; do not remount auth or app state.
    root.render(<Root />);
});
