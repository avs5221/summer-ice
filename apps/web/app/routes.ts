import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("register", "routes/register.tsx"),
  route("schedule", "routes/schedule.tsx"),
  route("admin", "routes/admin.tsx"),
  route("admin/session/:id", "routes/admin.session.tsx"),
] satisfies RouteConfig;
