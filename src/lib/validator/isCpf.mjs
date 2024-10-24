/**
 * Validates a Brazilian CPF number.
 *
 * A CPF number consists of 11 digits, often formatted as XXX.XXX.XXX-YY. This function verifies
 * the structure, checks for common invalid patterns, and validates the check digits.
 *
 * @param {string} cpf - The CPF number to be validated.
 * @returns {boolean} Returns true if the CPF is valid, otherwise false.
 */
export function isCpf (cpf) {
  const str = String(cpf)
  if (str.length > 14) return false
  const s = str.replace(/\D/gim, '')
  if (s.length !== 11) return false
  if (s === s[0].repeat(11)) return false
  const a = s.split('').map(c => parseInt(c, 10))
  if (a[9] !== expectedDigit(a.slice(0, 9), 10)) return false
  if (a[10] !== expectedDigit(a.slice(0, 10), 11)) return false
  return true
  function expectedDigit (b, K) {
    const weightedSum = b.reduce((Σ, d, i) => Σ + d * (K - i), 0)
    const remainder = (weightedSum * 10) % 11
    return remainder % 10
  }
}
