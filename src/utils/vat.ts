import { env } from "../config/env";

export function calcVat(subtotal: number): number {
  return Number((subtotal * env.vatRate).toFixed(2));
}

export function calcGrandTotal(
  subtotal: number,
  shipping = 0
): { vat: number; total: number } {
  const vat = calcVat(subtotal);
  const total = Number((subtotal + vat + shipping).toFixed(2));
  return { vat, total };
}
