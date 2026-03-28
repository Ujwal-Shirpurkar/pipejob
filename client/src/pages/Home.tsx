import { useEffect, useState } from "react";
import { getJobs } from "../services/api";

export default function Home() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    getJobs().then(setJobs);
  }, []);

  return (
    <div>
      <h1>Jobs</h1>
      {jobs.map((job: any) => (
        <div key={job.id}>
          <h3>{job.title}</h3>
          <p>{job.company_name}</p>
        </div>
      ))}
    </div>
  );
}
