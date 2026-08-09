// Skeleton entrypoint only. No pg-boss wiring, no jobs yet — see
// docs/ARCHITECTURE.md §6. Runs directly on Node's native TypeScript
// support (Node 24+), no build step.

function main(): void {
  console.log("[worker] summer-ice worker starting");
  console.log("[worker] no jobs registered yet — exiting");
}

main();
