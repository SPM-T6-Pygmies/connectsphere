import { NotificationDetail } from "../../../notification-detail";

export default async function Page({
  params,
}: PageProps<"/staff/coordinator/notifications/[id]">) {
  const { id } = await params;

  return <NotificationDetail role="coordinator" notificationId={id} />;
}
