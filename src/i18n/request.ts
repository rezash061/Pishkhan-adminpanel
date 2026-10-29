import { getRequestConfig } from "next-intl/server";
import messages from "@/messages/fa.json";

// The admin panel is Persian only (overview assumption A4); there is no locale routing.
export default getRequestConfig(async () => ({
  locale: "fa",
  timeZone: "Asia/Tehran",
  messages,
}));
