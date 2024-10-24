/**
 * Validates a Brazilian CNPJ number.
 *
 * A CNPJ number consists of 14 digits, often formatted as XX.XXX.XXX/XXXX-XX. This function verifies
 * the structure, checks for common invalid patterns, and validates the check digits.
 *
 * @param {string} cnpj - The CNPJ number to be validated.
 * @returns {boolean} Returns true if the CNPJ is valid, otherwise false.
 */
export function isCnpj (cnpj) {
  const str = String(cnpj)
  if (str.length > 18) return false
  const s = str.replace(/\D/gim, '')
  if (s.length !== 14) return false
  const a = s.split('').map(c => parseInt(c, 10))
  if (s === s[0].repeat(14)) return false
  if (
    a[12] !==
    expectedDigit(a.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  ) return false
  if (
    a[13] !==
    expectedDigit(a.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  ) return false
  return true
  function expectedDigit (b, w) {
    const weightedSum = b.reduce((Σ, d, i) => Σ + d * w[i], 0)
    const remainder = weightedSum % 11
    if (remainder <= 1) return 0
    return 11 - remainder
  }
}
