import type { AccountType, StoreKind } from "@/lib/backend";

/**
 * Plaza X es para comprar. Las empresas y emprendimientos venden en sus tiendas y quien
 * quiera se afilia para ganar comisión. Cada rol entra por su propia puerta:
 * comprador → al pagar · afiliado → Panel Afiliados · empresa → Panel Empresas.
 */
export const ROLES: {
  id: AccountType;
  label: string;
  short: string;
  icon: string;
  /** Panel del rol (null: se queda comprando). */
  home: "/vendedores" | "/afiliados" | null;
}[] = [
  {
    id: "comprador",
    label: "Comprador",
    short: "Compra en las tiendas de la plaza",
    icon: "fa-bag-shopping",
    home: null,
  },
  {
    id: "afiliado",
    label: "Afiliado",
    short: "Recomienda productos y gana comisión",
    icon: "fa-users",
    home: "/afiliados",
  },
  {
    id: "empresa",
    label: "Empresa o emprendimiento",
    short: "Vende tus productos en tu tienda",
    icon: "fa-building",
    home: "/vendedores",
  },
];

export const roleOf = (t: AccountType | undefined) => ROLES.find((r) => r.id === t) ?? ROLES[0]!;

/** Tipo de tienda por defecto: empresa (se puede cambiar a emprendimiento). */
export const storeKindFor = (_t?: AccountType): StoreKind => "empresa";

/** Nombre del panel de ventas en el menú de la persona. */
export const sellerPanelLabel = (_t?: AccountType, storeKind?: StoreKind) =>
  storeKind === "persona" ? "Mi emprendimiento" : "Panel Empresa";

/** Lo que cada persona ve en su menú, según su tipo de cuenta y lo que ya usa. */
export function spaces(
  accountType: AccountType | undefined,
  hasStore: boolean,
  hasUsername = false,
) {
  return {
    /** Ya vende (tiene tienda) o es empresa. */
    sells: hasStore || accountType === "empresa",
    // Quien ya eligió su usuario de afiliado también promociona.
    promotes: accountType === "afiliado" || hasUsername,
  };
}
