import express from "express";

import { productsRouter } from "./routes/products.routes.js";

export const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

app.use("/api/products", productsRouter);