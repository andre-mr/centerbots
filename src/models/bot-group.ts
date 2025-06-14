export class BotGroup {
  constructor(
    public BotId: number,
    public Broadcast: boolean,
    public GroupId: number,
    public Members: number,
    public Name: string
  ) {}
}
