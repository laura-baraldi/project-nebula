
import { Router } from "express";

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  res.status(200).json({
    message: "Welcome to the Nebula product catalog!"
  });
});
