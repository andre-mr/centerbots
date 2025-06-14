export class Member {
  constructor(
    public Id: number,
    public MemberJid: string,

    public IsAdmin: boolean | null = null, // in-memory, used only when associated with a group
    public LastRead: string | null = null // in-memory, not stored in DB
  ) {}
}
