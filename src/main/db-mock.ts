import {
  createBot,
  createGroup,
  createMessage,
  createAuthorizedNumber,
  createBotGroup,
  createGroupMember,
  createMessageEvent,
  createGroupMemberEvent,
  createForwardPayload,
  getAllBots,
  getAllMembers,
  getAllGroups,
  getMessagesByPeriod,
  getOrCreateMemberId,
} from "./db-commands";
import { Bot } from "../models/bot-model";
import { Group } from "../models/group-model";
import { Message } from "../models/message-model";
import {
  Status,
  WhatsAppSources,
  SendMethods,
} from "../models/bot-options-model";

export async function seedMockData(): Promise<void> {
  const now = new Date().toISOString();

  const botA = new Bot(
    0,
    "553499991111",
    "Campanha A",
    WhatsAppSources.All,
    SendMethods.Text,
    2,
    10,
    null,
    now,
    false,
    [],
    false,
    Status.Online,
    0
  );
  const botB = new Bot(
    0,
    "553499992222",
    "Campanha B",
    WhatsAppSources.Direct,
    SendMethods.Image,
    3,
    12,
    JSON.stringify(["tracking.com"]),
    now,
    false,
    [],
    false,
    Status.Sending,
    0
  );
  const botC = new Bot(
    0,
    "553499993333",
    "Campanha C",
    WhatsAppSources.Group,
    SendMethods.Forward,
    4,
    8,
    null,
    now,
    false,
    [],
    false,
    Status.Disconnected,
    0
  );
  const botAId = await createBot(botA);
  const botBId = await createBot(botB);
  const botCId = await createBot(botC);

  const grpA = new Group(0, "111222333444-159753", "Grupo A", 0);
  const grpB = new Group(0, "555666777888-357159", "Grupo B", 0);
  const grpC = new Group(0, "999000111222-246810", "Grupo C", 0);
  const grpAId = await createGroup(grpA);
  const grpBId = await createGroup(grpB);
  const grpCId = await createGroup(grpC);

  const memberJids = [
    "553499990001",
    "553499990002",
    "553499990003",
    "553499990004",
  ];

  const memberIds = await Promise.all(
    memberJids.map((jid) => getOrCreateMemberId(jid))
  );

  await createGroupMember(grpAId, memberIds[0], false);
  await createGroupMember(grpAId, memberIds[1], true);
  await createGroupMember(grpBId, memberIds[2], false);
  await createGroupMember(grpCId, memberIds[3], false);

  await createAuthorizedNumber(botAId, memberJids[0]);
  await createAuthorizedNumber(botAId, memberJids[1]);
  await createAuthorizedNumber(botBId, memberJids[2]);
  await createAuthorizedNumber(botCId, memberJids[3]);

  await createBotGroup(botAId, grpAId, 1);
  await createBotGroup(botAId, grpBId, 0);
  await createBotGroup(botBId, grpCId, 1);

  const msg1 = new Message(
    0,
    "Olá Grupo A!",
    now,
    "msgid-1",
    memberJids[0],
    null,
    null
  );
  const msg2 = new Message(
    0,
    "Bem-vindo ao Grupo B!",
    now,
    "msgid-2",
    memberJids[1],
    null,
    null
  );
  const msg3 = new Message(
    0,
    "Notícia Grupo C",
    now,
    "msgid-3",
    memberJids[2],
    null,
    null
  );
  const msg4 = new Message(
    0,
    "Promoção Grupo D",
    now,
    "msgid-4",
    memberJids[3],
    null,
    null
  );
  const msg1Id = await createMessage(msg1, [botAId]);
  const msg2Id = await createMessage(msg2, [botBId]);
  const msg3Id = await createMessage(msg3, [botCId]);
  const msg4Id = await createMessage(msg4, [botAId, botBId, botCId]);

  await createForwardPayload(
    msg1Id,
    JSON.stringify({ id: "wa1", content: "payload1" })
  );
  await createForwardPayload(
    msg2Id,
    JSON.stringify({ id: "wa2", content: "payload2" })
  );
  await createForwardPayload(
    msg3Id,
    JSON.stringify({ id: "wa3", content: "payload3" })
  );
  await createForwardPayload(
    msg4Id,
    JSON.stringify({ id: "wa4", content: "payload4" })
  );

  await createMessageEvent(msg1Id, memberJids[1], now);
  await createMessageEvent(msg2Id, memberJids[2], now);
  await createMessageEvent(msg3Id, memberJids[3], now);
  await createMessageEvent(msg4Id, memberJids[0], now);

  await createGroupMemberEvent(grpAId, memberJids[1], "leave", now);
  await createGroupMemberEvent(grpBId, memberJids[2], "join", now);
  await createGroupMemberEvent(grpCId, memberJids[3], "join", now);

  console.log("✅ Mock data inserted successfully");
}

export async function checkEmptyDatabaseAndSeed(): Promise<boolean> {
  const groups = await getAllGroups();
  if (groups.length > 0) return false;

  const members = await getAllMembers();
  if (members.length > 0) return false;

  const bots = await getAllBots();
  if (bots.length > 0) return false;

  const now = new Date().toISOString();
  const messages = await getMessagesByPeriod("1970-01-01T00:00:00.000Z", now);
  if (messages.length > 0) return false;

  await seedMockData().catch((err) => {
    console.error("❌ Error seeding mock data:", err);
    process.exit(1);
  });

  return true;
}
