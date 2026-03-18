import { notFound, redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";

export const requireAdminPageAccess = async () => {
  try {
    const viewer = await fetchAuthQuery(api.admin.getAdminViewer, {});
    if (!viewer.isAdmin) {
      notFound();
    }
    return viewer;
  } catch {
    redirect("/sign-in");
  }
};
