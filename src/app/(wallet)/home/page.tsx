import { redirect } from "next/navigation";

export default function HomePage(): void {
  redirect("/dashboard");
}
