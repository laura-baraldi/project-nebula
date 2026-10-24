// Shape of each product returned by the cart API.
export type CartItem = {
  product_id: string;
  name: string;
  image_url: string | null;
  price_pawstars: number;
  quantity: number;
  subtotal_pawstars: number;
  is_available: boolean;
};

export type CartResponse = {
  items: CartItem[];
  total_pawstars: number;
};
