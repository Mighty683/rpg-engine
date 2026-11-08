/** Limit expensive password hashing without queuing unbounded unauthenticated work. */
let running = 0;
const limit = 4;

export async function withPasswordHashCapacity<T>(operation: () => Promise<T>): Promise<T> {
  if (running >= limit)
    throw Object.assign(new Error("Password service busy"), { code: "auth_busy" });
  running++;
  try {
    return await operation();
  } finally {
    running--;
  }
}
