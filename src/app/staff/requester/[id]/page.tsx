import { RequestDetail } from "../request-detail";

export default async function Page({ params }: PageProps<"/staff/requester/[id]">) {
  const { id } = await params;

  return <RequestDetail id={id} />;
}
