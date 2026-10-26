import { cleanupTestLists } from "./cleanup";

export default async function globalTeardown() {
  await cleanupTestLists();
}
