import { enrichPlaceWithGoogle } from "../server/lib/google-places";

async function main() {
  const placeId = parseInt(process.argv[2] || "17");
  console.log(`Enriching place ID: ${placeId}`);
  const success = await enrichPlaceWithGoogle(placeId);
  console.log(`Enrichment result: ${success ? "SUCCESS" : "FAILED"}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
