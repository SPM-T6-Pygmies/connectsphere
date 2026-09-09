import { CoordinatorDetail } from "../coordinator-detail";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/staff/coordinator/[id]">) {
  const { id } = await params;
  const { tab, activity } = await searchParams;

  return <CoordinatorDetail id={id} tab={tab} activity={activity} />;
}
