import { createQueue } from "../src/routers/positions/shared";

const queue = createQueue();
const id = "6fb37bb34e01e99a9545f602df5317d356788e3e78efd1552e22a5f620f0937f";
await queue.retryJobs();
console.log("Fuckkkk");
