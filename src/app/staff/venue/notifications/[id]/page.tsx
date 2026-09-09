import { NotificationDetail } from "../../../notification-detail";

export default async function Page({
  params,
}: PageProps<"/staff/venue/notifications/[id]">) {
  const { id } = await params;

  return <NotificationDetail role="venue" notificationId={id} />;
}
