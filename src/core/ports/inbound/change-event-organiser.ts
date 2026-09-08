export interface ChangeEventOrganiserCommand {
  readonly eventRequestId: string;
  readonly newResponsibleOrganiserId: string;
}

export interface ChangeEventOrganiserResult {
  readonly eventRequestId: string;
  readonly responsibleOrganiserId: string;
}

export interface ChangeEventOrganiser {
  execute(command: ChangeEventOrganiserCommand): Promise<ChangeEventOrganiserResult>;
}
