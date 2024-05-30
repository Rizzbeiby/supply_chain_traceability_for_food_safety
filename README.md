# Supply Chain Traceability for Food Safety

The Supply Chain Traceability for Food Safety project is a blockchain-based platform designed to ensure transparency and accountability in the food supply chain. By recording each step a product takes from its origin to the end consumer, this platform enhances food safety and helps quickly identify and address potential contamination or quality issues.

## Features

### 1. Product Management

- **Create:** Add new food products to the supply chain.
- **Read:** Retrieve details of all food products or a specific product.
- **Update:** Modify details of existing food products.
- **Delete:** Remove food products from the system.

### 2. Traceability

- Record each step in the supply chain, including transfers between entities.
- Maintain a comprehensive history of all actions taken on a product.

### 3. Ownership and Location Transfer

- Facilitate the transfer of products between different entities in the supply chain.
- Update the current location and owner of the product.

### 4. Inspection and Quality Checks

- Record inspection and quality check events.
- Store inspection results, timestamps, and remarks.

### 5. Expiration Date and Shelf Life

- Track the expiration date and shelf life for each product.
- Trigger alerts when a product is near or past its expiration date.

### 6. Input Validation

- Validate all inputs to prevent incorrect data entry and ensure data integrity.

## Getting Started

To run the Supply Chain Traceability for Food Safety project locally, follow these steps:

1. Install Node.js and npm.
2. Clone the repository: `git clone https://github.com/your/repository.git`
3. Install dependencies: `npm install`
4. Start the server: `npm start`
5. Access the API endpoints using an HTTP client such as Postman or curl.

## API Endpoints

The project exposes the following API endpoints:

1. `POST /products`: Create a new food product.
2. `GET /products`: Get all food products.
3. `GET /products/:id`: Get details of a specific product by ID.
4. `PUT /products/:id`: Update details of a specific product by ID.
5. `DELETE /products/:id`: Delete a specific product by ID.
6. `POST /products/:id/transfer`: Transfer ownership and location of a product.
7. `POST /products/:id/inspect`: Record an inspection for a product.
