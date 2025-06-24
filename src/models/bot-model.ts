import {
  Status,
  WhatsAppSources,
  SendMethods,
  SendingMessageInfo,
  LinkParameters,
} from "./bot-options-model";

export class Bot {
  constructor(
    public Id: number,
    public WaNumber: string,
    public Campaign: string | null,
    public WhatsAppSources: WhatsAppSources,
    public SendMethod: SendMethods,
    public DelayBetweenGroups: number,
    public DelayBetweenMessages: number,
    public LinkParameters: LinkParameters,
    public Updated: string,
    public Proxy: string | null,
    public Active: boolean, // in-memory, not stored in DB
    public AuthorizedNumbers: string[], // in-memory, not stored in DB
    public Paused: boolean, // in-memory, not stored in DB
    public Status: Status, // in-memory, not stored in DB
    public TotalGroups: number, // in-memory, not stored in DB
    public sendingMessageInfo?: SendingMessageInfo // in-memory, not stored in DB
  ) {}
}
