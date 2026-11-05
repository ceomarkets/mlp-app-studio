import type { AccountType, StoreKind } from "@/lib/backend";

/**
 * Registro general de Plaza X en tres tipos de cuenta:
 * 1. Compra y venta: una persona que compra y, si quiere, vende lo suyo (sin ser empresa).
 * 2. Afiliados: recomiendan productos y ganan comisión.
 * 3. Empresas: venden como negocio.
 */
export const ROLES: {
  id: AccountType;
  n: 1 | 2 | 3;
  label: string;
  short: string;
  icon: string;
  /** Panel al que llega después de entrar (null: se queda en la plaza). */
  home: "/vendedores" | "/afiliados" | null;
}[] = [
  {
    id: "comprador",
    n: 1,
    label: "Compra y venta",
    short: "Compra y vende como persona, sin ser empresa",
    icon: "fa-arrow-right-arrow-left",
    home: null,
  },
  {
    id: "afiliado",
    n: 2,
    label: "Afiliados",
    short: "Recomienda productos y gana comisión",
    icon: "fa-users",
    home: "/afiliados",
  },
  {
    id: "empresa",
    n: 3,
    label: "Empresas",
    short: "Vende como negocio, con tu marca",
    icon: "fa-building",
    home: "/vendedores",
  },
];

export const roleOf = (t: AccountType | undefined) => ROLES.find((r) => r.id === t) ?? ROLES[0]!;

/** Tipo de tienda según la cuenta: la empresa vende como empresa; los demás, como persona. */
export const storeKindFor = (t: AccountType | undefined): StoreKind =>
  t === "empresa" ? "empresa" : "persona";

/** Nombre del panel de ventas: "Mi tienda" (persona) o "Panel Empresa". */
export const sellerPanelLabel = (t: AccountType | undefined, storeKind?: StoreKind) =>
  (storeKind ?? storeKindFor(t)) === "persona" ? "Mi tienda" : "Panel Empresa";

/** Lo que cada persona ve en su menú, según su tipo de cuenta y lo que ya usa. */
export function spaces(
  accountType: AccountType | undefined,
  hasStore: boolean,
  hasUsername = false,
) {
  return {
    /** Ya vende (tiene tienda) o es empresa. */
    sells: hasStore || accountType === "empresa",
    /** Puede abrir su tienda como persona (cuenta de compra y venta). */
    canSell: accountType !== "afiliado" || hasStore,
    // Quien ya eligió su usuario de afiliado también promociona.
    promotes: accountType === "afiliado" || hasUsername,
  };
}
