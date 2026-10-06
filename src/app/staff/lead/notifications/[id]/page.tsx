import { NotificationDetail } from "../../../notification-detail";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/staff/lead/notifications/[id]">) {
  const { id } = await params;
  const { tab, activity } = await searchParams;

  return <NotificationDetail
      role="lead"
      recordId={id}
      tab={tab}
      activity={activity}
    />;
}
