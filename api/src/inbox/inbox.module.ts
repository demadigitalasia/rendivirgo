import { Module } from "@nestjs/common";
import { AdminMessagesController, ContactController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [ContactController, AdminMessagesController, NotificationsController],
  providers: [MessagesService, NotificationsService],
  exports: [NotificationsService],
})
export class InboxModule {}
