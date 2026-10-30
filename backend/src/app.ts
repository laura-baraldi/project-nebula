import express from "express";
import cors from "cors";

import { productsRouter } from "./routes/products.routes.js";
import { cartRouter } from "./routes/cart.routes.js";
import { checkoutRouter } from "./routes/checkout.routes.js";

export const app = express();

app.use(express.json());

// Only this frontend is trusted for credentialed requests.
const trustedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

app.use("/api/products", productsRouter);

// CORS handles response headers and OPTIONS preflight requests.
// cartSecurity separately checks Origin before modifications.
const apiCors = cors({
  origin: trustedOrigin,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type"],
});

app.use("/api/cart", apiCors, cartRouter);
app.use("/api/checkout", apiCors, checkoutRouter);
