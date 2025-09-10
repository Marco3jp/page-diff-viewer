import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/api/screenshot", "routes/api.screenshot.ts"),
] satisfies RouteConfig;
