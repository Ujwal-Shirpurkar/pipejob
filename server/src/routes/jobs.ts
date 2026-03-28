import { Router } from "express";
import { fetchJobs } from "../scrapers/jobs";
import { analyzeJob } from "../services/ai";

const router = Router();

router.get("/", async (req, res) => {
  const jobs = await fetchJobs();

  const analyzed = await Promise.all(
    jobs.map(async (job: any) => {
      const ai = await analyzeJob(job);
      return { ...job, ai };
    }),
  );

  res.json(analyzed);
});

export default router;
