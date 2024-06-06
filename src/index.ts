import { v4 as uuidv4 } from "uuid";
import { Server, StableBTreeMap, ic } from "azle";
import express from "express";

/**
 * Represents a food product in the supply chain.
 */
class FoodProduct {
  id: string;
  name: string;
  origin: string;
  currentLocation: string;
  owner: string;
  status: string;
  history: string[]; // Array to store product history
  createdAt: Date;
  updatedAt: Date | null;
  expirationDate: Date;
  inspections: Inspection[];
}

class Inspection {
  id: string;
  inspector: string;
  timestamp: Date;
  result: string; // e.g., "Passed", "Failed"
  remarks: string;
}

const foodProductsStorage = StableBTreeMap<string, FoodProduct>(0);

export default Server(() => {
  const app = express();
  app.use(express.json());

  // Helper function to get the current date
  function getCurrentDate() {
    const timestamp = Number(ic.time());
    return new Date(timestamp / 1000_000);
  }

  // Create a new product
  app.post("/products", (req, res) => {
    const { name, origin, owner, expirationDate } = req.body;

    // Validate input
    if (!name || !origin || !owner || !expirationDate) {
      return res.status(400).json({
        error: "Name, origin, owner, and expiration date are required fields",
      });
    }

    const product: FoodProduct = {
      id: uuidv4(),
      name,
      origin,
      currentLocation: origin,
      owner,
      status: "Created",
      history: [`Product created at ${origin} by ${owner}`],
      createdAt: getCurrentDate(),
      updatedAt: null,
      expirationDate: new Date(expirationDate),
      inspections: [],
    };

    foodProductsStorage.insert(product.id, product);
    res.json(product);
  });

  // Get all products
  app.get("/products", (req, res) => {
    res.json(foodProductsStorage.values());
  });

  // Get a specific product
  app.get("/products/:id", (req, res) => {
    const productId = req.params.id;
    const productOpt = foodProductsStorage.get(productId);
    if ("None" in productOpt) {
      res.status(404).send(`Product with ID=${productId} not found`);
    } else {
      res.json(productOpt.Some);
    }
  });

  // Update a product
  app.put("/products/:id", (req, res) => {
    const productId = req.params.id;
    const { name, status, expirationDate } = req.body;

    // Validate input
    if (!name && !status && !expirationDate) {
      return res.status(400).json({
        error:
          "At least one field (name, status, or expiration date) must be provided",
      });
    }

    const productOpt = foodProductsStorage.get(productId);
    if ("None" in productOpt) {
      res.status(404).send(`Product with ID=${productId} not found`);
    } else {
      const product = productOpt.Some;
      const updatedProduct = {
        ...product,
        name: name || product.name,
        status: status || product.status,
        expirationDate: expirationDate ? new Date(expirationDate) : product.expirationDate,
        updatedAt: getCurrentDate(),
      };
      updatedProduct.history.push(`Product updated: ${JSON.stringify(req.body)}`);
      foodProductsStorage.insert(product.id, updatedProduct);
      res.json(updatedProduct);
    }
  });

  // Delete a product
  app.delete("/products/:id", (req, res) => {
    const productId = req.params.id;
    const deletedProduct = foodProductsStorage.remove(productId);
    if ("None" in deletedProduct) {
      res.status(404).send(`Product with ID=${productId} not found`);
    } else {
      res.json(deletedProduct.Some);
    }
  });

  // Transfer product ownership and location
  app.post("/products/:id/transfer", (req, res) => {
    const productId = req.params.id;
    const { newOwner, newLocation } = req.body;

    // Validate input
    if (!newOwner || !newLocation) {
      return res.status(400).json({ error: "New owner and new location are required fields" });
    }

    const productOpt = foodProductsStorage.get(productId);
    if ("None" in productOpt) {
      res.status(404).send(`Product with ID=${productId} not found`);
      return;
    }

    const product = productOpt.Some;
    const updatedProduct = {
      ...product,
      owner: newOwner,
      currentLocation: newLocation,
      updatedAt: getCurrentDate(),
    };
    updatedProduct.history.push(`Ownership transferred to ${newOwner} and moved to ${newLocation}`);
    foodProductsStorage.insert(product.id, updatedProduct);
    res.json(updatedProduct);
  });

  // Record an inspection
  app.post("/products/:id/inspect", (req, res) => {
    const productId = req.params.id;
    const { inspector, result, remarks } = req.body;

    // Validate input
    if (!inspector || !result) {
      return res.status(400).json({ error: "Inspector and result are required fields" });
    }

    const productOpt = foodProductsStorage.get(productId);
    if ("None" in productOpt) {
      res.status(404).send(`Product with ID=${productId} not found`);
      return;
    }

    const product = productOpt.Some;
    const inspection: Inspection = {
      id: uuidv4(),
      inspector,
      timestamp: getCurrentDate(),
      result,
      remarks: remarks || "",
    };

    product.inspections.push(inspection);
    product.history.push(`Inspection conducted by ${inspector}: ${result}`);

    foodProductsStorage.insert(product.id, product);
    res.json(product);
  });

  // Get product history
  app.get("/products/:id/history", (req, res) => {
    const productId = req.params.id;
    const productOpt = foodProductsStorage.get(productId);
    if ("None" in productOpt) {
      res.status(404).send(`Product with ID=${productId} not found`);
    } else {
      res.json(productOpt.Some.history);
    }
  });

  return app.listen();
});
