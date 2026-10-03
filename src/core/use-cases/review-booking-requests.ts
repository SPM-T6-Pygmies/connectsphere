import type { BookingId } from "../domain/booking";
import { BookingNotFoundError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import type { Venue } from "../domain/venue";
import type {
  BookingForReview,
  BookingReviewRepository,
  BookingReviewSection,
} from "../ports/outbound/booking-review-repository";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export type { BookingForReview, BookingReviewSection } from "../ports/outbound/booking-review-repository";

export interface ReviewBookingRequestsDeps {
  readonly reviews: BookingReviewRepository;
  readonly venues: VenueCatalogue;
}

export interface BookingReviewDetail {
  readonly booking: BookingForReview;
  /** The venue as the catalogue holds it now; null if it has since gone. */
  readonly venue: Venue | null;
  /** Venues Venue Staff may point the coordinator to instead. */
  readonly alternatives: readonly Venue[];
}

/**
 * SPM-22: what Venue Staff read before deciding -- the queue of requests, the
 * decided and archived lists, and one booking beside the venue it is for.
 *
 * Thin reads (ARCHITECTURE.md section 11): the store's staff scoping is the
 * only thing that can say no.
 */
export class ReviewBookingRequestsUseCase {
  constructor(private readonly deps: ReviewBookingRequestsDeps) {}

  async list(
    staff: string,
    section: BookingReviewSection,
  ): Promise<readonly BookingForReview[]> {
    return this.deps.reviews.list(userAccountId(staff), section);
  }

  /** Throws `BookingNotFoundError` when there is no such booking, or the caller may not see it (#91). */
  async open(staff: string, bookingId: string): Promise<BookingReviewDetail> {
    const booking = await this.deps.reviews.find(userAccountId(staff), bookingId as BookingId);
    if (booking === null) {
      throw new BookingNotFoundError(bookingId);
    }

    const venues = await this.deps.venues.list();
    return {
      booking,
      venue: venues.find((candidate) => candidate.id === booking.venueId) ?? null,
      alternatives: venues.filter((candidate) => candidate.id !== booking.venueId),
    };
  }
}
