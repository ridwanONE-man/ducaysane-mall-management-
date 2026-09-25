export function numberToWords(num: number, currency: 'USD' | 'SSP' = 'USD'): string {
  if (isNaN(num) || num <= 0) {
    return currency === 'USD' ? 'Zero US Dollars Only' : 'Zero South Sudanese Pounds Only';
  }

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertChunk(n: number): string {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  }

  const wholeNumber = Math.floor(num);
  const cents = Math.round((num - wholeNumber) * 100);

  if (wholeNumber === 0) {
    if (cents > 0) {
      return currency === 'USD' 
        ? `${cents}/100 Cents Only` 
        : `${cents}/100 Piasters Only`;
    }
    return currency === 'USD' ? 'Zero US Dollars Only' : 'Zero South Sudanese Pounds Only';
  }

  let words = '';
  const billions = Math.floor(wholeNumber / 1000000000);
  const millions = Math.floor((wholeNumber % 1000000000) / 1000000);
  const thousands = Math.floor((wholeNumber % 1000000) / 1000);
  const remainder = wholeNumber % 1000;

  if (billions > 0) {
    words += convertChunk(billions) + ' Billion ';
  }
  if (millions > 0) {
    words += convertChunk(millions) + ' Million ';
  }
  if (thousands > 0) {
    words += convertChunk(thousands) + ' Thousand ';
  }
  if (remainder > 0) {
    words += convertChunk(remainder) + ' ';
  }

  words = words.trim();

  const currencyUnit = currency === 'USD' 
    ? (wholeNumber === 1 ? 'US Dollar' : 'US Dollars') 
    : 'South Sudanese Pounds';

  if (cents > 0) {
    return `${words} ${currencyUnit} and ${cents}/100 Only`;
  }
  return `${words} ${currencyUnit} Only`;
}
