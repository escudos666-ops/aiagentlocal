import express from "express";
import { insertOrder } from "./playwright/insertOrder.js";

const app = express();
app.use(express.json());

app.post("/insert-order", async (req, res) => {
  const order = req.body.order;

  try {
    const result = await insertOrder(order);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
      stack: err.stack
    });
  }
});

app.listen(3000, () => console.log("Playwright service running on port 3000"));
