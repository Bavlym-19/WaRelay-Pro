import { pgTable, text, serial, integer, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "sending", "done", "partial", "failed"]);
export const contactStatusEnum = pgEnum("contact_status", ["pending", "sent", "failed", "will_sell", "will_buy", "not_interested"]);

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  messageTemplate: text("message_template"),
  messageTemplates: text("message_templates"),
  useAI: boolean("use_ai").notNull().default(false),
  minDelaySeconds: integer("min_delay_seconds").notNull().default(60),
  maxDelaySeconds: integer("max_delay_seconds").notNull().default(300),
  pauseEveryMessages: integer("pause_every_messages").notNull().default(0),
  pauseDurationSeconds: integer("pause_duration_seconds").notNull().default(120),
  status: campaignStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  plotNumber: text("plot_number").notNull(),
  area: text("area").notNull().default(""),
  district: text("district").notNull(),
  neighborhood: text("neighborhood").notNull(),
  sendSessionId: text("send_session_id"),
  status: contactStatusEnum("status").notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  notes: text("notes"),
});

export const whatsappMessageHistoryTable = pgTable("whatsapp_message_history", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  campaignId: integer("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const whatsappInstancesTable = pgTable("whatsapp_instances", {
  id: serial("id").primaryKey(),
  instanceId: text("instance_id").notNull().unique(),
  label: text("label"),
  active: boolean("active").notNull().default(true),
  sentCount: integer("sent_count").notNull().default(0),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;

export const insertContactSchema = createInsertSchema(contactsTable).omit({ id: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
