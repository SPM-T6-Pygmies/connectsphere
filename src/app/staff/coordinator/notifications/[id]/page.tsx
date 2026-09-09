import { NotificationDetail } from "../../../notification-detail";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/staff/coordinator/notifications/[id]">) {
  const { id } = await params;
  const { tab, activity } = await searchParams;

  return <NotificationDetail
      role="coordinator"
      notificationId={id}
      tab={tab}
      activity={activity}
    />;
}
