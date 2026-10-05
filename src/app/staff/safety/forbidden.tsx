import { AccessDenied } from "../access-denied";

export default function Forbidden() {
  return <AccessDenied area="safety" />;
}
