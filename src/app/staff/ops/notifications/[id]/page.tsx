import { NotificationDetail } from "../../../notification-detail";

export default async function Page({
  params,
}: PageProps<"/staff/ops/notifications/[id]">) {
  const { id } = await params;

  return <NotificationDetail role="ops" notificationId={id} />;
}
