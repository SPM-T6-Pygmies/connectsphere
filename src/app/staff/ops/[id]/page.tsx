import { LoadedAssignDetail } from "../assign-detail";

export default async function Page({ params }: PageProps<"/staff/ops/[id]">) {
  const { id } = await params;

  return <LoadedAssignDetail id={id} />;
}
