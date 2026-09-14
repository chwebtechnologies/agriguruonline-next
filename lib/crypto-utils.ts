/**
 * Encrypts a JSON object or array into a fast obfuscated base64 string
 * We use a custom base64 + reverse string obfuscation to be extremely fast
 * and avoid blocking the React UI thread or hitting Next.js payload limits.
 * @param data The data to encrypt
 * @returns Encrypted string
 */
export const encryptData = (data: any): string => {
  try {
    const jsonString = JSON.stringify(data);
    // Fast base64 encode using Buffer in Node/Next.js edge
    let base64 = '';
    if (typeof Buffer !== 'undefined') {
      base64 = Buffer.from(jsonString).toString('base64');
    } else {
      base64 = btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g,
          function toSolidBytes(match, p1) {
              return String.fromCharCode(Number('0x' + p1));
      }));
    }
    // Reverse the string for simple obfuscation against casual scraping
    return base64.split('').reverse().join('');
  } catch (error) {
    console.error('Encryption failed:', error);
    return '';
  }
};

/**
 * Decrypts the obfuscated string back into a JSON object or array
 * @param encryptedString The encrypted string
 * @returns Parsed JSON data or null if fails
 */
export const decryptData = (encryptedString: string): any => {
  try {
    if (!encryptedString) return null;
    
    // Reverse it back
    const base64 = encryptedString.split('').reverse().join('');
    
    let jsonString = '';
    if (typeof Buffer !== 'undefined') {
      jsonString = Buffer.from(base64, 'base64').toString('utf8');
    } else {
      jsonString = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    }
    
    if (!jsonString) return null;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};
