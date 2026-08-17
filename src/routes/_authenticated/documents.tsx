import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/documents")({
  component: () => <Navigate to="/library" replace />,
});
