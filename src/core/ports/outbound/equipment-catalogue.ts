import type {
  EquipmentItem,
  EquipmentItemId,
  NewEquipmentItem,
} from "../../domain/equipment-item";
import type { EventReservation } from "../../domain/equipment-review";

/**
 * Driven port: the equipment ConnectSphere owns, as Technical Support Staff
 * maintain it (SPM-40).
 *
 * The catalogue starts empty -- nothing is imported from an existing equipment
 * database (#12) -- and holds a quantity per line, not a record per unit (#13).
 */
export interface EquipmentCatalogue {
  /** Every catalogue line, ordered by type. */
  list(): Promise<readonly EquipmentItem[]>;
  findById(id: EquipmentItemId): Promise<EquipmentItem | null>;
  /** Stores a record the core has built and hands back the id the store chose. */
  create(item: NewEquipmentItem): Promise<EquipmentItem>;
  /** Persists a change to an existing line; the store has already given it an id. */
  save(item: EquipmentItem): Promise<void>;
  /** Every event's reservation of the item, whatever the event's status (SPM-274 AC7). */
  reservationsOf(id: EquipmentItemId): Promise<readonly EventReservation[]>;
}
