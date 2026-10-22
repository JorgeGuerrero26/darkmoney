/**
 * Interés pactado al crear: lo que se devolverá en total menos el monto. Mismo contrato que
 * móvil (agreedInterest.ts): se pide el total, no un porcentaje; el porcentaje que resulta
 * (sobre el monto, por todo el plazo) solo se guarda como dato informativo.
 */
export function agreedInterest({ principal, returnTotal }: { principal: number; returnTotal: number }) {
  const cents = (value: number) => Math.round(value * 100);
  const belowPrincipal = principal > 0 && returnTotal > 0 && cents(returnTotal) < cents(principal);
  const interestAmount = principal > 0 && cents(returnTotal) > cents(principal) ? (cents(returnTotal) - cents(principal)) / 100 : 0;
  const interestPercent = interestAmount > 0 ? Math.round((interestAmount / principal) * 10000) / 100 : null;
  return { interestAmount, interestPercent, belowPrincipal };
}
