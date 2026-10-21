import { DepositRecord, PropertyUnit } from '../types';
import { formatMoney } from './printUtils';

export type RentCurrency = 'USD' | 'SSP';

// A unit is rented in SSP when it has an SSP rent and no dollar rent; otherwise in dollars.
export const unitCurrency = (u?: PropertyUnit | null): RentCurrency =>
  u && !((u.monthlyRateUSD || 0) > 0) && (u.monthlyRateSSP || 0) > 0 ? 'SSP' : 'USD';

export const unitRent = (u?: PropertyUnit | null): number =>
  !u ? 0 : unitCurrency(u) === 'SSP' ? u.monthlyRateSSP || 0 : u.monthlyRateUSD || 0;

export const formatUnitRent = (u?: PropertyUnit | null) => formatMoney(unitRent(u), unitCurrency(u));

// Rent fields for a unit rented at `amount` in `currency` (the other currency is left at 0)
export const rentFields = (amount: number, currency: RentCurrency) => ({
  monthlyRateUSD: currency === 'USD' ? amount : 0,
  monthlyRateSSP: currency === 'SSP' ? amount : 0,
});

// A deposit's amount in a given currency
export const depositIn = (d: DepositRecord, currency: RentCurrency) =>
  currency === 'SSP' ? d.amountSSP || 0 : d.amountUSD || 0;

// Amount fields for a deposit of `amount` in `currency`
export const depositFields = (amount: number, currency: RentCurrency) => ({
  amountUSD: currency === 'USD' ? amount : 0,
  amountSSP: currency === 'SSP' ? amount : 0,
  currency,
});

// "$1,200.00 + 400,000 SSP" — shows each currency only when it has a value
export const formatBoth = (usd: number, ssp: number) =>
  [usd || !ssp ? formatMoney(usd, 'USD') : '', ssp ? formatMoney(ssp, 'SSP') : ''].filter(Boolean).join(' + ');
