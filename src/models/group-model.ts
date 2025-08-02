export class Group {
  constructor(
    public Id: number,
    public GroupJid: string,
    public Name: string,
    public Updated: string,
    public InviteLink: string = "",
    public TotalMembers: number, // in-memory, not stored in DB
    public Broadcast?: boolean // in-memory, not stored in DB
  ) {}
}
