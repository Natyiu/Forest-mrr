import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
} from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete"],
  file: ["upload", "read", "delete"],
  settings: ["read", "update"],
} as const;

export const ac = createAccessControl(statement);

export const user = ac.newRole({
  project: ["create", "read"],
  file: ["upload", "read"],
  settings: ["read"],
});

export const admin = ac.newRole({
  project: ["create", "read", "update", "delete"],
  file: ["upload", "read", "delete"],
  settings: ["read", "update"],
  ...adminAc.statements,
});
