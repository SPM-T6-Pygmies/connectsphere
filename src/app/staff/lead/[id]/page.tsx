import { LoadedAssignDetail } from "../assign-detail";

export default async function Page({ params }: PageProps<"/staff/lead/[id]">) {
  const { id } = await params;

  return <LoadedAssignDetail id={id} />;
}
