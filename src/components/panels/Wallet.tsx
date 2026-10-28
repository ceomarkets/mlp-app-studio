import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet as WalletIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Stat } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backend } from "@/lib/backend";
import { cop, HOLD_DAYS, MIN_WITHDRAWAL, PAYOUT_METHODS, type PayoutMethod } from "@/lib/plaza";
import { keys, useUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const STATUS = {
  requested: { label: "En proceso", cls: "bg-sun text-accent-foreground" },
  paid: { label: "Pagado", cls: "bg-secondary text-secondary-foreground" },
  rejected: { label: "Rechazado", cls: "bg-destructive text-destructive-foreground" },
};

/** Billetera única: ganancias de la tienda + comisiones de afiliado. */
export function WalletPanel() {
  const wallet = useQuery({ queryKey: keys.wallet, queryFn: () => backend.wallet() });
  const history = useQuery({ queryKey: keys.withdrawals, queryFn: () => backend.myWithdrawals() });
  const [open, setOpen] = useState(false);
  const w = wallet.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          tone="ink"
          label="Disponible para retirar"
          value={w ? cop(w.available) : "…"}
          hint={`Mínimo ${cop(MIN_WITHDRAWAL)}`}
        />
        <Stat
          label="Retenido"
          value={w ? cop(w.pending) : "…"}
          hint={`Se libera ${HOLD_DAYS} días después de la entrega`}
        />
        <Stat label="Retirado" value={w ? cop(w.withdrawn) : "…"} />
        <div className="flex flex-col justify-between gap-3 rounded-2xl bg-primary p-5 text-primary-foreground shadow-card">
          <div className="text-sm opacity-90">Recibe en Nequi, Daviplata o Bancolombia</div>
          <Button
            variant="secondary"
            disabled={!w || w.available < MIN_WITHDRAWAL}
            onClick={() => setOpen(true)}
          >
            <WalletIcon /> Retirar
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-bold">Historial de retiros</h3>
        <div className="overflow-hidden rounded-2xl border bg-card">
          {history.data?.length ? (
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th>Método</th>
                  <th>Monto</th>
                  <th className="pr-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="p-3">
                      {new Date(h.createdAt).toLocaleDateString("es-CO", { dateStyle: "medium" })}
                    </td>
                    <td>
                      {PAYOUT_METHODS.find((m) => m.id === h.method)?.label} ···
                      {h.account.slice(-4)}
                    </td>
                    <td className="font-semibold">{cop(h.amount)}</td>
                    <td className="pr-3 text-right">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-bold",
                          STATUS[h.status].cls,
                        )}
                      >
                        {STATUS[h.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Aún no has hecho retiros.
            </p>
          )}
        </div>
      </div>

      {w && <WithdrawDialog open={open} onOpenChange={setOpen} available={w.available} />}
    </div>
  );
}

function WithdrawDialog({
  open,
  onOpenChange,
  available,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  available: number;
}) {
  const qc = useQueryClient();
  const { user } = useUser();
  const [amount, setAmount] = useState(available);
  const [method, setMethod] = useState<PayoutMethod>("nequi");
  const [account, setAccount] = useState(user?.phone ?? "");
  const m = useMutation({
    mutationFn: () => backend.requestWithdrawal(amount, method, account),
    onSuccess: () => {
      toast.success("Retiro solicitado", { description: "Lo pagamos en 1 a 2 días hábiles." });
      qc.invalidateQueries({ queryKey: keys.wallet });
      qc.invalidateQueries({ queryKey: keys.withdrawals });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Retirar ganancias</DialogTitle>
          <DialogDescription>Disponible: {cop(available)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {PAYOUT_METHODS.map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => setMethod(pm.id)}
                className={cn(
                  "rounded-xl border p-3 text-sm font-semibold transition",
                  method === pm.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:border-primary",
                )}
              >
                {pm.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc">
              {method === "bancolombia" ? "Número de cuenta de ahorros" : "Número de celular"}
            </Label>
            <Input
              id="acc"
              inputMode="numeric"
              value={account}
              onChange={(e) => setAccount(e.target.value.replace(/[^0-9 ]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amt">Monto</Label>
            <Input
              id="amt"
              type="number"
              min={MIN_WITHDRAWAL}
              max={available}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <div className="flex gap-2">
              {[0.5, 1].map((f) => (
                <button
                  key={f}
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => setAmount(Math.floor((available * f) / 1000) * 1000)}
                >
                  {f === 1 ? "Todo" : "La mitad"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={
              m.isPending ||
              amount < MIN_WITHDRAWAL ||
              amount > available ||
              account.trim().length < 7
            }
            onClick={() => m.mutate()}
          >
            {m.isPending && <Loader2 className="animate-spin" />} Solicitar {cop(amount || 0)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
