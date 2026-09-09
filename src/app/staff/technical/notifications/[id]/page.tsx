import { NotificationDetail } from "../../../notification-detail";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/staff/technical/notifications/[id]">) {
  const { id } = await params;
  const { tab, activity } = await searchParams;

  return <NotificationDetail
      role="technical"
      notificationId={id}
      tab={tab}
      activity={activity}
    />;
}
