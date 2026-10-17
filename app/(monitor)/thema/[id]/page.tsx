import { redirect } from "next/navigation";

/** Alte Adresse: weitergeleitet, damit schon geteilte Links weiter funktionieren */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/beschluss/${encodeURIComponent(id)}`);
}
