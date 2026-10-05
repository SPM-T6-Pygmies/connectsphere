import { NotTechnicalSupportStaffError } from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EquipmentRecheckRepository,
  UnderReviewEquipmentLine,
} from "@/core/ports/outbound/equipment-recheck-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import {
  toEquipmentRecheckError,
  toUnderReviewEquipmentLine,
  type UnderReviewEquipmentRow,
} from "./equipment-recheck-mapper";

/**
 * SPM-41 AC15, through `technical_support_equipment_rechecks`, not the tables
 * -- RLS is on with no policies and their grants were revoked. The function
 * re-checks that the reader is Technical Support Staff (AC16) and answers
 * CS040 if not, which comes back as the domain's own error.
 */
export class SupabaseEquipmentRecheckRepository implements EquipmentRecheckRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async linesUnderReview(reader: UserAccountId): Promise<readonly UnderReviewEquipmentLine[]> {
    const key = toKey(reader);
    if (key === null) {
      // An id this store could never have issued is not Technical Support Staff.
      throw new NotTechnicalSupportStaffError();
    }

    const { data, error } = await this.client.rpc("technical_support_equipment_rechecks", {
      p_user_account_id: key,
    });

    if (error) {
      throw (
        toEquipmentRecheckError(error) ??
        new Error(`Failed to read the equipment re-check list: ${error.message}`, { cause: error })
      );
    }

    return ((data ?? []) as unknown as UnderReviewEquipmentRow[]).map(toUnderReviewEquipmentLine);
  }
}
