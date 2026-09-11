/**
 * Discarding a draft event request (SPM-38, added alongside saving one --
 * not in the original brief, but the natural undo for it).
 */
export interface DiscardEventRequestDraftCommand {
  readonly eventRequestId: string;
  readonly responsibleOrganiserId: string;
  readonly clientOrganisationId: string;
}

export interface DiscardEventRequestDraft {
  execute(command: DiscardEventRequestDraftCommand): Promise<void>;
}
