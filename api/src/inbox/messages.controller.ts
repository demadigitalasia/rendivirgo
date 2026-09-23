import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CreateMessageDto, MessageQueryDto, ReplyMessageDto, UpdateMessageDto } from "./dto/inbox.dto";
import { MessagesService } from "./messages.service";

@Controller("contact")
export class ContactController {
  constructor(private readonly messagesService: MessagesService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateMessageDto) {
    return this.messagesService.create(dto);
  }
}

@Controller("admin/messages")
export class AdminMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(@Query() query: MessageQueryDto) {
    return this.messagesService.listAdmin(query);
  }

  @Get(":id")
  detail(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.messagesService.getAdminById(id, auditContextFrom(request));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateMessageDto, @Req() request: AuthenticatedRequest) {
    return this.messagesService.update(id, dto, auditContextFrom(request));
  }

  @Post(":id/reply")
  reply(@Param("id") id: string, @Body() dto: ReplyMessageDto, @Req() request: AuthenticatedRequest) {
    return this.messagesService.reply(id, dto.adminReply, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.messagesService.remove(id, auditContextFrom(request));
  }
}
