import { NotificationDetail } from "../../../notification-detail";

export default async function Page({
  params,
}: PageProps<"/staff/requester/notifications/[id]">) {
  const { id } = await params;

  return <NotificationDetail role="requester" notificationId={id} />;
}
