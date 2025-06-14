export enum Status {
  Online = "Online",
  Sending = "Sending",
  Disconnected = "Disconnected",
  LoggedOut = "Loggedout",
  Offline = "Offline",
}

export enum WhatsAppSources {
  All = "All",
  Direct = "Direct",
  Group = "Group",
}

export enum SendMethods {
  Text = "Text",
  Image = "Image",
  Forward = "Forward",
}

export interface SendingMessageInfo {
  content: string;
  currentGroup: string;
  currentGroupIndex: number;
  totalGroups: number;
}
