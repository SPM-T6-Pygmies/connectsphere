import { EventEquipmentDetail } from "../event-equipment-detail";

export const metadata = { title: "Equipment | ConnectSphere" };

export default async function Page({ params }: PageProps<"/staff/technical/[id]">) {
  const { id } = await params;

  return <EventEquipmentDetail id={id} />;
}
