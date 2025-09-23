export type OnceSchedule = {
  Year: number;
  Month: number; // 1-12
  Day: number; // 1-31
  Hour: number; // 0-23
  Minute: number; // 0-59
};

export type DailySchedule = {
  Hour: number;
  Minute: number;
};

export type WeeklySchedule = {
  // Days of week as numbers: 0=Sunday ... 6=Saturday
  Days: number[];
  Hour: number;
  Minute: number;
};

export type MonthlySchedule = {
  Dates: number[]; // days of month 1-31
  Hour: number;
  Minute: number;
};

export class Schedule {
  constructor(
    public Id: number,
    public Description: string,
    public Contents: string[],
    public Images: Buffer[],
    public Medias: string[],
    public Created: string,
    public LastRun: string,
    public BotIds: number[],
    public Once: OnceSchedule | null,
    public Daily: DailySchedule | null,
    public Weekly: WeeklySchedule | null,
    public Monthly: MonthlySchedule | null
  ) {}
}
