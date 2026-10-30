const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type CheckoutOrderItem = {
  product_name: string;
  quantity: number;
  unit_price_pawstars: number;
  line_total_pawstars: number;
};

export type CheckoutOrder = {
  order_number: string;
  customer_email: string;
  total_pawstars: number;
  payment_status: "simulated";
  created_at: string;
  items: CheckoutOrderItem[];
};

type CheckoutResponse = {
  order: CheckoutOrder;
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class CheckoutApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutApiError";
  }
}

export async function checkout(customerEmail: string): Promise<CheckoutOrder> {
  const response = await fetch(`${API_BASE_URL}/api/cart/checkout`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_email: customerEmail,
    }),
  });

  if (!response.ok) {
    let message = "Checkout failed.";
    let code = "UNKNOWN_ERROR";

    try {
      const data = (await response.json()) as ApiErrorResponse;

      message = data.error?.message ?? message;
      code = data.error?.code ?? code;
    } catch {
      // The server may return an empty or non-JSON error.
    }

    throw new CheckoutApiError(response.status, code, message);
  }

  const data = (await response.json()) as CheckoutResponse;

  return data.order;
}
