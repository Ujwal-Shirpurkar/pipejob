import cron from "node-cron";
import { fetchJobs } from "../scrapers/jobs";

cron.schedule("0 * * * *", async () => {
  console.log("Running cron job...");
  const jobs = await fetchJobs();
  console.log("Jobs fetched:", jobs.length);
});
