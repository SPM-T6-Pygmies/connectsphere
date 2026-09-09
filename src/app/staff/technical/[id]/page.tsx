import { ReservationDetail } from "../reservation-detail";

export default async function Page({ params }: PageProps<"/staff/technical/[id]">) {
  const { id } = await params;

  return <ReservationDetail id={id} />;
}
