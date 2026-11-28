import { MongoTopologyClosedError } from "mongodb";

export async function withRetry<T>(
  fn: () => Promise<T>,
  tries = 2,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof MongoTopologyClosedError && tries > 1) {
      return withRetry(fn, tries - 1);
    }

    throw e;
  }
}
