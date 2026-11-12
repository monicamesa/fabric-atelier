//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { type ReactNode } from "react";

import { useAuth } from "@/hooks/auth.context";
import type { LaunchStage } from "@/launch/launch-machine";
import { LaunchGate } from "@/launch/launch-gate";

interface AuthGateProps {
    children: ReactNode;
}

const PENDING: LaunchStage = { status: "pending" };
const SIGNED_OUT: LaunchStage = { status: "error", error: { kind: "session", details: "No signed-in Fabric session." } };

/** Step 1 of the launch screen: the Fabric session. The app itself mounts once it exists. */
export function AuthGate({ children }: AuthGateProps) {
    const { isLoading, isAuthenticated, signInError } = useAuth();

    if (isLoading) {
        return <LaunchGate session={PENDING} docket={PENDING} />;
    }

    if (!isAuthenticated) {
        const session: LaunchStage = signInError
            ? { status: "error", error: { kind: "signIn", details: `Sign-in failed: ${signInError.message}` } }
            : SIGNED_OUT;
        return <LaunchGate session={session} docket={PENDING} />;
    }

    return <>{children}</>;
}
