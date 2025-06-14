export class BotMessage {
  constructor(
    public BotId: number,
    public MessageId: number,
    public Content: string // memory only, not stored in DB
  ) {}
}
