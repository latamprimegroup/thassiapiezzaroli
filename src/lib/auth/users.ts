import type { UserRole } from "./rbac";

export type DemoUser = {
  id: string;
  name: string;
  role: UserRole;
};

export const demoUsers: DemoUser[] = [
  { id: "u-ceo", name: "Patricia (CEO)", role: "ceo" },
  { id: "u-tech-admin", name: "Igor (Tech Admin)", role: "techAdmin" },
  { id: "u-fin", name: "Marcos (Financeiro)", role: "financeManager" },
  { id: "u-copy-jr", name: "Bia (Copy Junior)", role: "copyJunior" },
  { id: "u-copy-sr", name: "Ana (Copy Senior)", role: "copySenior" },
  { id: "u-traf-jr", name: "Leo (Trafego Junior)", role: "trafficJunior" },
  { id: "u-traf-sr", name: "Caio (Trafego Senior)", role: "trafficSenior" },
  { id: "u-editor", name: "Nati (Editor)", role: "productionEditor" },
  { id: "u-designer", name: "Lia (Designer)", role: "productionDesigner" },
  { id: "u-closer", name: "Rafa (Closer)", role: "closer" },
  { id: "u-cx", name: "Luana (CX Manager)", role: "cxManager" },
];

export function getDemoUserById(userId: string) {
  return demoUsers.find((user) => user.id === userId);
}
