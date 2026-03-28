export async function getJobs() {
  const res = await fetch("http://localhost:3000/jobs");
  return res.json();
}
