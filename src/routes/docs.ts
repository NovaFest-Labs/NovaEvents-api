import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";
import fs from "fs";
import path from "path";

const router = Router();

// Resolve the spec relative to the project root so it works from both
// `src/` (ts-node-dev) and `dist/` (compiled output).
const specPath = path.resolve(__dirname, "../../openapi.yaml");
const specContent = fs.readFileSync(specPath, "utf-8");
const swaggerDocument = parse(specContent) as Record<string, unknown>;

router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(swaggerDocument, {
  customSiteTitle: "NovaEvents API Docs",
}));

export default router;
