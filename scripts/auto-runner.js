const url = process.env.AUTO_RUN_URL || "http://127.0.0.1:3000/api/schedule/auto-run";

async function tick() {
  try {
    await fetch(url, { method: "POST" });
  } catch (err) {
    // Ignore network errors; next tick will retry.
  }
}

tick();
setInterval(tick, 60 * 1000);
