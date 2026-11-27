import { loadConfig } from "./config";

// Composition root: builds adapters, repositories and use cases and wires them together
// (docs/ARCHITECTURE.md §3). Nothing is wired yet; the running app is still in ../legacy.

const config = loadConfig();
console.log(`Vyrse server skeleton, port ${config.port}: nothing is wired yet.`);
