/**
 * Converts a numeric amount to English words in standard trade banking format.
 * E.g.:
 * 276, 'USD' -> 'Two Hundred Seventy Six USD ONLY'
 * 777600, 'USD' -> 'Seven Hundred Seventy Seven Thousand Six Hundred USD ONLY'
 * 45000.50, 'USD' -> 'Forty Five Thousand USD and Fifty Cents ONLY'
 * 1234567, 'USD' -> 'One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven USD ONLY'
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertThreeDigitChunk(n: number): string {
  let str = '';
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    str += `${ONES[hundreds]} Hundred`;
    if (remainder > 0) {
      str += ' ';
    }
  }

  if (remainder > 0) {
    if (remainder < 20) {
      str += ONES[remainder];
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      str += TENS[tens];
      if (ones > 0) {
        str += ` ${ONES[ones]}`;
      }
    }
  }

  return str;
}

export function convertAmountToWords(amount: number | string, currencyCode: string = 'USD'): string {
  const numericVal = typeof amount === 'number' ? amount : parseFloat(String(amount || 0).replace(/,/g, ''));
  const cleanCurrency = String(currencyCode || 'USD').toUpperCase().trim();

  if (isNaN(numericVal) || numericVal <= 0) {
    return `Zero ${cleanCurrency} ONLY`;
  }

  const integerPart = Math.floor(numericVal);
  const decimalPart = Math.round((numericVal - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) {
    return `Zero ${cleanCurrency} ONLY`;
  }

  const chunks: { value: number; label: string }[] = [
    { value: 1000000000, label: 'Billion' },
    { value: 1000000, label: 'Million' },
    { value: 1000, label: 'Thousand' },
    { value: 1, label: '' },
  ];

  let currentInt = integerPart;
  const wordsParts: string[] = [];

  for (const chunk of chunks) {
    if (currentInt >= chunk.value) {
      const chunkCount = Math.floor(currentInt / chunk.value);
      currentInt %= chunk.value;
      const chunkWords = convertThreeDigitChunk(chunkCount);
      if (chunkWords) {
        wordsParts.push(chunk.label ? `${chunkWords} ${chunk.label}` : chunkWords);
      }
    }
  }

  let finalStr = wordsParts.join(' ').trim();
  if (!finalStr) {
    finalStr = 'Zero';
  }

  if (decimalPart > 0) {
    const decimalWords = convertThreeDigitChunk(decimalPart);
    const subUnit = cleanCurrency === 'INR' ? (decimalPart === 1 ? 'Paisa' : 'Paise') : (decimalPart === 1 ? 'Cent' : 'Cents');
    return `${finalStr} ${cleanCurrency} and ${decimalWords} ${subUnit} ONLY`;
  }

  return `${finalStr} ${cleanCurrency} ONLY`;
}

