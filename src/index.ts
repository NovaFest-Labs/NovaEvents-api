import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import eventsRouter from "./routes/events";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/events", eventsRouter);

app.listen(PORT, () => {
  console.log(`NovaEvents API running on port ${PORT}`);
});

export default app;
