export const runtime = "nodejs";

export default function AuthRequiredPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center bg-[#050505] p-6 text-slate-100">
      <section className="w-full rounded border border-amber-300/30 bg-amber-500/10 p-4 text-sm">
        <h1 className="text-base font-semibold text-amber-100">Sessão necessária</h1>
        <p className="mt-2 text-slate-200">
          O ERP requer autenticação para acesso. Faça login com seu provedor de autenticação (Supabase) ou use o fluxo interno
          de sessão antes de abrir os módulos operacionais.
        </p>
      </section>
    </main>
  );
}

