import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { ContactEmailOutboxService } from "./contact-email-outbox.service";
import { AdminMessagesController, ContactController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [SettingsModule],
  controllers: [ContactController, AdminMessagesController, NotificationsController],
  providers: [ContactEmailOutboxService, MessagesService, NotificationsService],
  exports: [NotificationsService],
})
export class InboxModule {}
