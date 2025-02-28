'use strict'
const Formats = require('./format')
const { u8aToHex, hexToU8a, stringToU8a } = require('@polkadot/util')

class Utils {
  /**
   * Converts Hex to Base64
   *
   * @param {string} str source
   * @returns {object} Base64 encoded from Hex
   */
  static hexToBase64 (str) {
    return Buffer.from(str, 'hex').toString('utf8')
  }

  /**
   * Converts Base64 to Hex
   *
   * @param {string} str source
   * @returns {object} Hex encoded from Base64
   */
  static base64ToHex (str) {
    return Buffer.from(str, 'utf8').toString('hex')
  }

  /**
   * Converts string u8 to string
   *
   * @param {string} str source
   * @returns {object} Hex encoded from u8
   */
  static stringU8aToString (str) {
    let u8 = ''
    for (let i = 0; i < str.length; i += 2) {
      u8 = u8 + String.fromCodePoint(parseInt(str[i], 16) * 16 + parseInt(str[i + 1], 16))
    }
    return u8
  }

  /**
   * Converts string u8 hexadecimal
   *
   * @param {string} str source
   * @returns {object} Hex encoded from u8
   */
  static stringToU8aHex (str) {
    const HexChars = '0123456789abcdef'
    let u8 = ''
    for (let i = 0; i < str.length; i++) {
      const cp = str.codePointAt(i)
      const cpr = cp % 16
      const cp1 = (cp - cpr) / 16
      u8 = u8 + HexChars[cp1] + HexChars[cpr]
    }
    return u8
  }

  /**
   * Converts to UTF8 Array
   *
   * @param {string} str source
   * @returns {object} UTF8 Array
   */
  static toUTF8Array (str) {
    const buffer = Buffer.from(str, 'utf8')
    return Array.prototype.slice.call(buffer, 0)
  }

  /**
   * Verify correct token hex string
   *
   * @param {string} str source
   * @param {string} format source string format
   * @returns {boolean} True if string is correct
   */
  static verifyTokenFormat (str, format) {
    if (!format) {
      format = Formats.DEFAULT
    }
    let s = str
    if (str.includes(':')) {
      const s1 = str.split(':')
      if (s1.length === 4) {
        s = s1[3]
      } else {
        if (s1.length === 3) {
          s = s1[2]
        }
      }
    }
    switch (s.slice(0, 1)) {
      case 'T':
        if (s.slice(1).startsWith('0x')) {
          str = str.slice(1)
        } else {
          if (s.slice(1).includes('-')) {
            str = this.fromBase58ToHex(str)
          } else {
            str = this.fromTokenStandardToHex(str)
          }
        }
        break
      default:
        str = str.slice(0)
        break
    }
    return parseInt(this.verifyHexString('0x' + str), 16)
  }

  /**
   * Verify correct hex string
   *
   * @param {string} str source
   * @param {string} format source string format
   * @returns {boolean} True if string is correct
   */
  static verifyDIDString (str, format) {
    if (!format) {
      format = Formats.DEFAULT
    }
    let s = str
    if (str.includes(':')) {
      const s1 = str.split(':')
      if (s1.length === 4) {
        s = s1[3]
      } else {
        if (s1.length === 3) {
          s = s1[2]
        }
      }
    }
    switch (s.slice(0, 1)) {
      case 'A':
        if (s.slice(1).startsWith('0x')) {
          str = str.slice(1)
        } else {
          if (s.slice(1).includes('-')) {
            str = this.fromBase58ToHex(str)
          } else {
            str = this.fromStandardToHex(str)
          }
        }
        break
      case 'C':
        if (s.slice(1).startsWith('0x')) {
          str = str.slice(1)
        } else {
          if (s.slice(1).includes('-')) {
            str = this.fromBase58ToHex(str)
          } else {
            str = this.fromStandardToHex(str)
          }
        }
        break
      case 'T':
        str = '0x' + str.slice(1)
        break
      default:
        str = str.slice(0)
        break
    }
    return this.verifyHexString(str)
  }

  /**
   * Verify correct hex string
   *
   * @param {string} str source
   * @returns {boolean} True if string is correct
   */
  static verifyHexString (str) {
    let pattern = null
    if (str.slice(0, 2) === '0X') {
      pattern = /[A-F0-9]/gi
    } else {
      if (str.slice(0, 2) === '0x') {
        pattern = /[a-f0-9]/gi
      } else {
        return false
      }
    }
    const result = str.slice(2).match(pattern)
    if (result.length !== str.length - 2) {
      return false
    }
    return str
  }

  static decimalToHex (d, padding) {
    let hex = Number(d).toString(16)
    padding = typeof (padding) === 'undefined' || padding === null ? padding = 2 : padding
    while (hex.length < padding) {
      hex = '0' + hex
    }
    return hex
  }

  /**
   * Convert any DID or CID from Standard to Hexadecimal
   *
   * @param {object} str DID in decimal format
   * @param {string} sep separator for type
   * @returns {bool} True if string is correct
   */
  static fromStandardToHex (str, sep) {
    const s = str.split(':')
    return '0x' + Utils.decimalToHex(1) +
                  Utils.decimalToHex(s[2].length) +
                  this.stringToU8aHex(s[2]) +
                  s[3].slice(1)
  }

  /**
   * Convert any Token Standard to Hexadecimal
   *
   * @param {object} str DID in decimal format
   * @param {string} sep separator for type
   * @returns {bool} True if string is correct
   */
  static fromTokenStandardToHex (str, sep) {
    const s1 = str.split(':')
    let s = ''
    let found = false
    for (let i = 1; i <= s1[3].slice(1).length; i++) {
      if (s1[3][i] !== '0') {
        found = true
        s = s + s1[3][i]
      } else {
        if (found) {
          s = s1[3][i]
        }
      }
    }
    if (s.length % 2 !== 0) {
      s = '0' + s
    }
    return s
  }

  /**
   * Format an hex string to the demanaded format
   *
   * @param {object} str type in hex format
   * @param {object} format type format
   * @param {string} prefix prefix for type
   * @param {string} method DID method
   * @param {string} sep separator for type
   * @returns {bool} True if string is correct
   */
  static formatHexString (str, format, prefix, method, sep = ':') {
    switch (format) {
      case Formats.STANDARD:
        str = this.DIDFromHexToStandard(str, prefix, method, sep)
        break
      case Formats.HEXADECIMAL:
        str = '' + prefix + sep + str
        break
      case Formats.BASE58:
        str = this.DIDFromHexToBase58(str, prefix, method, sep)
        break
      case Formats.DECIMAL:
        str = this.DIDFromHexToStandard(str, prefix, method, sep)
        break
      case Formats.DEFAULT:
        str = this.DIDFromHexToStandard(str, prefix, method, sep)
        break
      default:
        str = this.DIDFromHexToStandard(str, prefix, method, sep)
        break
    }
    return str
  }

  /**
   * Convert a DID from Hexadecimal to Base58
   *
   * @param {object} str DID in hex format
   * @param {string} prefix prefix for type
   * @param {string} method DID method
   * @param {string} sep separator for type
   * @returns {bool} True if string is correct
   */
  static DIDFromHexToBase58 (str, prefix, method, sep) {
    const s = 'did' + sep + method + sep + prefix + this.insertSeparator(this.toBase58(hexToU8a(str)))
    return s
  }

  /**
   * Convert a DID from Hexadecimal to Decimal
   *
   * @param {object} str DID in hex format
   * @param {string} prefix prefix for type
   * @param {string} method DID method
   * @param {string} sep separator for type
   * @returns {bool} True if string is correct
   */
  static DIDFromHexToStandard (str, prefix, method, sep) {
    const { version, networkLength, network, internalDid } = this.structDid(str)
    const s = 'did' + sep + method + sep + network + sep + prefix + internalDid.slice(2)
    return s
  }

  /**
   * Convert any DID or CID from Base58 to Hexadecimal
   *
   * @param {object} str DID in base58 format
   * @returns {bool} True if string is correct
   */
  static fromBase58ToHex (str) {
    const s = str.split(':')
    return u8aToHex(this.fromBase58(s[2].slice(1)))
  }
  
  /**
   * Convert any Token from Base58 to Hexadecimal
   *
   * @param {object} str DID in base58 format
   * @returns {bool} True if string is correct
   */
  static fromTokenBase58ToHex (str) {
    const s = str.split(':')
    return u8aToHex(this.fromBase58(s[2].slice(1)))
  }

  /**
   * Convert Uint8Array to Base58
   *
   * @param {object} str Uint8Array raw byte input
   * @returns {bool} True if string is correct
   */
  static toBase58 (str) {
    const Base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    // This will be the result string in Base58 returned
    let s = ''
    // The array for storing the stream of base58 digits
    const digits = []
    let j = 0

    // Loop through each byte in the input stream
    for (const i in str) {
      // Reset the base58 digit iterator
      j = 0
      // Set the initial carry amount equal to the current byte amount
      let carry = str[i]
      // Prepend the result string with a "1" (0 in base58) if the byte stream is zero and non-zero bytes haven't been seen yet (to ensure correct decode length)
      s += carry || s.length ^ i ? '' : 1
      // Start looping through the digits until there are no more digits and no carry amount
      while (j in digits || carry) {
        // Set the placeholder for the current base58 digit
        let n = digits[j]
        // Shift the current base58 one byte and add the carry amount (or just add the carry amount if this is a new digit)
        n = n ? n * 256 + carry : carry
        // Find the new carry amount (floored integer of current digit divided by 58)
        carry = n / 58 | 0
        // Reset the current base58 digit to the remainder (the carry amount will pass on the overflow)
        digits[j] = n % 58
        // Iterate to the next base58 digit
        j++
      }
    }
    // Since the base58 digits are backwards, loop through them in reverse order
    while (j--) {
      // Lookup the character associated with each base58 digit
      s += Base58Chars[digits[j]]
    }
    // Return the final base58 string
    return s
  }

  static fromBase58 (str) {
    const Base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    // Array for storing the stream of decoded bytes
    const d = []
    // Result byte array that will be returned
    const b = []
    // Iterator variable for the byte array (d)
    let j = 0
    // Carry amount variable that is used to overflow from the current byte to the next byte
    let carry
    // Temporary placeholder variable for the current byte
    let n
    // Filter dash characters if exists
    str = str.replace(/[-:]/gm, '')
    // Loop through each base58 character in the input string
    for (const i in str) {
      // Reset the byte iterator
      j = 0
      // Set the initial carry amount equal to the current base58 digit
      carry = Base58Chars.indexOf(str[i])
      // See if the base58 digit lookup is invalid (-1)
      if (carry < 0) {
        // If invalid base58 digit, bail out and return undefined
        return undefined
      }
      // Prepend the result array with a zero if the base58 digit is zero and non-zero characters haven't been seen yet (to ensure correct decode length)
      carry || b.length ^ i ? i : b.push(0)
      // Start looping through the bytes until there are no more bytes and no carry amount
      while (j in d || carry) {
        // Set the placeholder for the current byte
        n = d[j]
        // Shift the current byte 58 units and add the carry amount (or just add the carry amount if this is a new byte)
        n = n ? n * 58 + carry : carry
        // Find the new carry amount (1-byte shift of current byte value)
        carry = n >> 8
        // Reset the current byte to the remainder (the carry amount will pass on the overflow)
        d[j] = n % 256
        // Iterate to the next byte
        j++
      }
    }
    // Since the byte array is backwards, loop through it in reverse order
    while (j--) {
      // Append each byte to the result
      b.push(d[j])
    }
    // Return the final byte array in Uint8Array format
    return new Uint8Array(b)
  }

  static insertSeparator (str, sep = '-') {
    let s = ''
    for (let i = 0; i < str.length; i++) {
      if (i !== 0 && i % 4 === 0) {
        s += sep
      }
      s += str[i]
    }
    return s
  }
  
  /**
   * Destructure DID into its components as version.
   *
   * @param {string} did DID to search
   * @returns {object} Certificate array
   */
  static structDid (did) {
    const networkLength = parseInt(did.slice(4, 6), 16)
    return {
      version: did.slice(2, 4),
      networkLength: networkLength,
      network: this.stringU8aToString(did.slice(6, 6 + networkLength * 2)),
      internalDid: did.slice(0, 2).concat(did.slice(6 + networkLength * 2))
    }
  }
}

module.exports = Utils
