import type { Metadata } from "next";
import { NotFoundView } from "@/components/states/NotFoundView";

export const metadata: Metadata = { title: "Introuvable" };

export default function NotFound() {
  return <NotFoundView />;
}
