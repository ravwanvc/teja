import {sendPickupSms} from "../lib/reminder-sms.js";
import handler from "vinext/server/fetch-handler";
import { expireOrders } from "../lib/commerce.js";
import { pickupReminders } from "../lib/notifications.js";
export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: Cloudflare.Env) {
    await expireOrders(env.DB);
    await pickupReminders(env.DB);
    await sendPickupSms(env);
    const jobs = await env.DB.prepare(
      "SELECT key FROM deletion_jobs LIMIT 100",
    ).all<{ key: string }>();
    for (const job of jobs.results) {
      await env.BUCKET.delete(job.key);
      await env.DB.prepare("DELETE FROM deletion_jobs WHERE key=?")
        .bind(job.key)
        .run();
    }
  },
};
