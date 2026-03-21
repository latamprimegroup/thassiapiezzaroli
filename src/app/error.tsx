"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Mantém o erro isolado na árvore com log para investigação.
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center bg-[#050505] p-6 text-slate-100">
      <Card className="w-full border-rose-300/30 bg-rose-500/10">
        <CardHeader>
          <CardTitle className="text-base">Falha isolada pelo Global Error Boundary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Um erro inesperado foi contido sem derrubar o restante do ERP.</p>
          <p className="text-xs text-rose-100/90">{error.message || "Erro sem mensagem."}</p>
          <Button type="button" className="h-8 px-3 text-xs" onClick={() => reset()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

