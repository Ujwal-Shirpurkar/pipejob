import axios from "axios";

export async function fetchJobs() {
  const res = await axios.get("https://remotive.com/api/remote-jobs");
  return res.data.jobs.slice(0, 10);
}
