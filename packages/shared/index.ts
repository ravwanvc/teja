export type Role = "member" | "seller" | "admin";
export type Product = {
  id: string;
  owner: string;
  title: string;
  shop: string;
  image: string;
  images: string;
  price: number;
  original: number;
  stock: number;
  city: string;
  address: string;
  lat: number;
  lng: number;
  until: number;
  allergens: string;
  storage: string;
};
export type Order = {
  id: string;
  product: string;
  buyer: string;
  owner: string;
  title: string;
  qty: number;
  price: number;
  deposit: number;
  status: string;
  payment_state: string;
  code?: string;
  receipt_no?: number;
  is_mock: number;
  pickup_at: number;
  pickup_selected: number;
  paid_at: number;
  until: number;
  lat: number;
  lng: number;
  buyerPhone?: string;
};
export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role?: Role;
};
export const splitTotal = (price: number, qty: number) => {
  const total = price * qty,
    deposit = Math.ceil(total / 10);
  return { total, deposit, balance: total - deposit };
};
export const validPhone = (phone: string) => /^\+998\d{9}$/.test(phone);
