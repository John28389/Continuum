import { redirect } from "next/navigation";

/**
 * The root has no content of its own. The proxy sends unauthenticated visitors
 * to the login page, so this lands on the dashboard for anyone signed in.
 */
export default function RootPage() {
  redirect("/dashboard");
}
