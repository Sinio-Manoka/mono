import { redirect } from "next/navigation"

/**
 * The home page now lives at `/[id]/workflow`. Visiting `/` bounces the
 * user to a sensible default id so the existing flows keep working until
 * we add a workflow picker.
 */
export default function Page() {
  redirect("/default/workflow")
}