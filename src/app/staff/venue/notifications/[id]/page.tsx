import { NotificationDetail } from "../../../notification-detail";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/staff/venue/notifications/[id]">) {
  const { id } = await params;
  const { tab, activity } = await searchParams;

  return <NotificationDetail
      role="venue"
      notificationId={id}
      tab={tab}
      activity={activity}
    />;
}
