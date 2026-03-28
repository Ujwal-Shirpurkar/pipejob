import express from "express";
import cors from "cors";
import "dotenv/config";
import jobsRoute from "./routes/jobs";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/jobs", jobsRoute);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
