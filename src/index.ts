import { v4 as uuidv4 } from "uuid";
import { Server, StableBTreeMap, ic } from "azle";
import express from "express";
import jwt from "jsonwebtoken"; // Import JWT for token validation

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
  version: number; // Version number for optimistic locking
}

class Inspection {
  id: string;
  inspector: string;
  timestamp: Date;
  result: string; // e.g., "Passed", "Failed"
  remarks: string;
  inspectionType?: string;
  batchInfo?: string;
}

const foodProductsStorage = StableBTreeMap<string, FoodProduct>(0);

const SECRET_KEY = 'your-secret-key'; // Replace with your actual secret key

export default Server(() => {
  const app = express();
  app.use(express.json());

  // Middleware for error handling
  function errorHandler(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
  }

  // Middleware for UUID validation
  function validateUUID(req, res, next) {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: "Invalid UUID format" });
    }
    next();
  }

  // Middleware for authentication
  function authenticate(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized access" });
    }
    try {
      const user = jwt.verify(token, SECRET_KEY);
      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  // Middleware for role-based access control
  function authorize(roles) {
    return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    };
  }

  // Helper function to get the current date in Date format
  function getCurrentDate(): Date {
    const timestamp = new Number(ic.time());
    return new Date(timestamp.valueOf() / 1000_000);
  }

  // Create a new product
  app.post("/products", authenticate, authorize(["admin", "manager"]), (req, res) => {
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
      version: 1,
    };

    foodProductsStorage.insert(product.id, product);
    res.json(product);
  });

  // Get all products with pagination
  app.get("/products", authenticate, (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const products = foodProductsStorage.values();
    const start = (page - 1) * limit;
    const end = page * limit;
    res.json(products.slice(start, end));
  });

  // Get a specific product
  app.get("/products/:id", authenticate, validateUUID, (req, res) => {
    const productId = req.params.id;
    const productOpt = foodProductsStorage.get(productId);
    if ("None" in productOpt) {
      res.status(404).send({ error: `Product with ID=${productId} not found` });
    } else {
      res.json(productOpt.Some);
    }
  });

  // Update a product
  app.put("/products/:id", authenticate, validateUUID, authorize(["admin", "manager"]), (req, res) => {
    const productId = req.params.id;
    const { name, status, expirationDate, version } = req.body;

    // Validate input
    if (!name && !status && !expirationDate) {
      return res.status(400).json({
        error: "At least one field (name, status, or expiration date) must be provided",
      });
    }

    const productOpt = foodProductsStorage.get(productId);
    if ("None" in productOpt) {
      res.status(400).send({ error: `Product with ID=${productId} not found` });
    } else {
      const product = productOpt.Some;
      if (product.version !== version) {
        return res.status(409).json({ error: "Version conflict detected. Please refresh and try again." });
      }
      const updatedProduct = {
        ...product,
        ...req.body,
        updatedAt: getCurrentDate(),
        version: product.version + 1,
      };
      if (expirationDate) {
        updatedProduct.expirationDate = new Date(expirationDate);
      }
      updatedProduct.history.push(`Product updated: ${JSON.stringify(req.body)}`);
      foodProductsStorage.insert(product.id, updatedProduct);
      res.json(updatedProduct);
    }
  });

  // Delete a product
  app.delete("/products/:id", authenticate, validateUUID, authorize(["admin"]), (req, res) => {
    const productId = req.params.id;
    const deletedProduct = foodProductsStorage.remove(productId);
    if ("None" in deletedProduct) {
      res.status(400).send({ error: `Product with ID=${productId} not found` });
    } else {
      res.json(deletedProduct.Some);
    }
  });

  // Transfer product ownership and location
  app.post("/products/:id/transfer", authenticate, validateUUID, authorize(["admin", "manager"]), (req, res) => {
    const productId = req.params.id;
    const { newOwner, newLocation } = req.body;

    // Validate input
    if (!newOwner || !newLocation) {
      return res.status(400).json({ error: "New owner and new location are required fields" });
    }

    const productOpt = foodProductsStorage.get(productId);
    if ("None" in productOpt) {
      res.status(400).send({ error: `Product with ID=${productId} not found` });
      return;
    }

    const product = productOpt.Some;
    const updatedProduct = {
      ...product,
      owner: newOwner,
      currentLocation: newLocation,
      updatedAt: getCurrentDate(),
      version: product.version + 1,
    };
    updatedProduct.history.push(`Ownership transferred to ${newOwner} and moved to ${newLocation}`);

    foodProductsStorage.insert(product.id, updatedProduct);
    res.json(updatedProduct);
  });

  // Record an inspection
  app.post("/products/:id/inspect", authenticate, validateUUID, authorize(["inspector"]), (req, res) => {
    const productId = req.params.id;
    const { inspector, result, remarks, inspectionType, batchInfo } = req.body;

    // Validate input
    if (!inspector || !result) {
      return res.status(400).json({ error: "Inspector and result are required fields" });
    }

    const productOpt = foodProductsStorage.get(productId);
    if ("None" in productOpt) {
      res.status(400).send({ error: `Product with ID=${productId} not found` });
      return;
    }

    const product = productOpt.Some;
    const inspection: Inspection = {
      id: uuidv4(),
      inspector,
      timestamp: getCurrentDate(),
      result,
      remarks,
      inspectionType,
      batchInfo,
    };

    product.inspections.push(inspection);
    product.history.push(`Inspection conducted by ${inspector}: ${result}`);
    product.version += 1;

    foodProductsStorage.insert(product.id, product);
    res.json(product);
  });

  // Apply middleware
  app.use(errorHandler);

  return app.listen();
});
