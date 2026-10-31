/** Cupón elegido (por ejemplo desde la venta flash), recordado durante la sesión. */
const KEY = "plazax-coupon";

export function savedCoupon(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberCoupon(code: string | null) {
  try {
    if (code) sessionStorage.setItem(KEY, code.toUpperCase());
    else sessionStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
}
