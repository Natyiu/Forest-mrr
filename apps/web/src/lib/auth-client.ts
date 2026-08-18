import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import type { AccessControl } from "better-auth/plugins/access";
import { ac, admin, user } from "@Batman/auth/permissions";

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      // `createAccessControl(statement)` returns an access controller narrowed
      // to *our* statements, and better-auth's `adminClient` asks for the wide
      // `AccessControl`. The two are not assignable in that direction —
      // `newRole`'s type parameter makes them contravariant — even though this
      // is exactly the value better-auth's own docs pass here. The widening is
      // the declaration catching up with the value, not a behaviour change.
      ac: ac as unknown as AccessControl,
      roles: { admin, user },
    }),
    organizationClient(),
  ],
});
