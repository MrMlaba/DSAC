/**
 * The app's notion of "today". Defaults to the real clock; set APP_TODAY (an ISO
 * date) to freeze it for a repeatable demo or test run.
 */
export function now(): Date {
  const override = process.env.APP_TODAY;
  if (override) {
    const parsed = new Date(override);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
