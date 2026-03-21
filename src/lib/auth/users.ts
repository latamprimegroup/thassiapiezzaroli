import type { UserRole } from "./rbac";

export type DemoUser = {
  id: string;
  name: string;
  role: UserRole;
};

export const demoUsers: DemoUser[] = [
  { id: "u-ceo", name: "Patricia (CEO)", role: "ceo" },
  { id: "u-media", name: "Caio (Media Buyer)", role: "mediaBuyer" },
  { id: "u-copy", name: "Ana (Copywriter)", role: "copywriter" },
  { id: "u-editor", name: "Nati (Video Editor)", role: "videoEditor" },
  { id: "u-closer", name: "Rafa (Closer)", role: "closer" },
  { id: "u-cx", name: "Luana (CX Manager)", role: "cxManager" },
  { id: "u-fin", name: "Marcos (Finance Manager)", role: "financeManager" },
];

export function getDemoUserById(userId: string) {
  return demoUsers.find((user) => user.id === userId);
}
