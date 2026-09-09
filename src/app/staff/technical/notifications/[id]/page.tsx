import { NotificationDetail } from "../../../notification-detail";

export default async function Page({
  params,
}: PageProps<"/staff/technical/notifications/[id]">) {
  const { id } = await params;

  return <NotificationDetail role="technical" notificationId={id} />;
}
