import { Interface, Log } from "ethers";

export function parseEventByName(
  logs: Log[] | readonly Log[] | any[],
  iface: Interface,
  eventName: string
) {
  for (const log of logs) {
    try {
      const parsed = iface.parseLog(log as any);
      if (parsed?.name === eventName) {
        return parsed;
      }
    } catch {
      // ignore non-matching logs
    }
  }

  throw new Error(`Event ${eventName} not found in transaction logs`);
}
