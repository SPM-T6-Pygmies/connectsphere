import { BookingDetail } from "../booking-detail";

export default async function Page({ params }: PageProps<"/staff/venue/[id]">) {
  const { id } = await params;

  return <BookingDetail id={id} />;
}
