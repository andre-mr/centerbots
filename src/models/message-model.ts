import { proto } from "baileys";

export class Message {
  constructor(
    public Id: number,
    public Content: string | null,
    public Timestamp: string,
    public OriginalJid: string | null,
    public SenderJid: string | null,
    public Image: Buffer | null,
    public Video: Buffer | null, // Optional in-memory video buffer (not stored in DB)
    public Schedule: string | null, // stored in DB as TEXT

    public ImageThumbnailBase64: string | null, // in-memory, not stored in DB
    public WaMessage: proto.IWebMessageInfo | null // in-memory, not stored in DB
  ) {}
}
