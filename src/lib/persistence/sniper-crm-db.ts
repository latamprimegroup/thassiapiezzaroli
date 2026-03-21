// MVP: para manter compatibilidade imediata com ambientes sem schema provisionado,
// o adaptador de "database mode" reutiliza as operações do store.
// Em produção com schema dedicado, este arquivo pode ser substituído por SQL nativo
// sem alterar as chamadas da camada de repositório.
export * from "@/lib/persistence/sniper-crm-store";

