export function calculateDiscountAmount(price: number, discount: number, discountType: 'percentage' | 'fixed'): number {
  if (discountType === 'percentage') {
    return (price * discount) / 100;
  } else {
    return discount;
  }
}

export function calculatePurchasePrice(price: number, discount: number, discountType: 'percentage' | 'fixed'): number {
  const discountAmount = calculateDiscountAmount(price, discount, discountType);
  return Math.max(0, price - discountAmount);
}

export function calculateFinalPrice(price: number, discount: number, discountType: 'percentage' | 'fixed', shipping_charges: number = 0, tax: number = 0, quantity: number = 1): number {
  const discountedPrice = calculatePurchasePrice(price, discount, discountType);
  const totalBeforeTax = discountedPrice * quantity + shipping_charges;
  const taxAmount = (totalBeforeTax * tax) / 100;
  return discountedPrice + (shipping_charges / quantity) + (taxAmount / quantity);
}

export function calculateTaxAmount(price: number, discount: number, discountType: 'percentage' | 'fixed', shipping_charges: number = 0, tax: number = 0, quantity: number = 1): number {
  const discountedPrice = calculatePurchasePrice(price, discount, discountType);
  const totalBeforeTax = discountedPrice * quantity + shipping_charges;
  return (totalBeforeTax * tax) / 100 / quantity;
}

export function formatPrice(price: number): string {
  return `₹${price.toFixed(2)}`;
}