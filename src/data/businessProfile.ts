import { defaultMallSettings } from './commercialData';

// Single source of truth for the letterhead printed on receipts and statements.
export const BUSINESS_PROFILE = {
  name: defaultMallSettings.mallName,
  shortName: 'NBC',
  tagline: 'Commercial Shops & Business Spaces',
  address: defaultMallSettings.address || 'Nyakuron East, Juba - South Sudan',
  phones: ['+211 928 223 154', '+211 924 991 131', '+211 921 515 150'],
  email: defaultMallSettings.contactEmail || 'info@nyakuroncentre.com',
  managerName: defaultMallSettings.managerName || 'Mohamed Mohamoud',
};
