import { Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { NotificationQueryDto } from "./dto/inbox.dto";
import { NotificationsService } from "./notifications.service";

@Controller("admin/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Query() query: NotificationQueryDto) {
    return this.notificationsService.list(query);
  }

  @Get("unread-count")
  unreadCount() {
    return this.notificationsService.unreadCount();
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string) {
    return this.notificationsService.markRead(id);
  }

  @Post("read-all")
  markAllRead() {
    return this.notificationsService.markAllRead();
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.notificationsService.remove(id);
  }
}
