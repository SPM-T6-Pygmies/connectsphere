import { EventDetail } from "../event-detail";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/staff/coordinator/[id]">) {
  const { id } = await params;
  const { tab, activity } = await searchParams;

  return <EventDetail id={id} tab={tab} activity={activity} />;
}
