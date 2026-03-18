import { notFound, redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";

export const requireAdminPageAccess = async () => {
  const viewer = await (async () => {
    try {
      return await fetchAuthQuery(api.admin.getAdminViewer, {});
    } catch {
      redirect("/admin-signin");
    }
  })();

  if (!viewer.isAuthenticated) {
    redirect("/admin-signin");
  }

  if (!viewer.isAdmin) {
    notFound();
  }

  return viewer;
};
