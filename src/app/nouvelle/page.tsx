import type { Metadata } from "next";
import { CreateList } from "@/components/create/CreateList";

export const metadata: Metadata = { title: "Nouvelle liste" };

export default function NewListPage() {
  return <CreateList />;
}
