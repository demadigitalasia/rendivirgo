import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { ConditionsService } from "./conditions.service";
import { CreateConditionDto, UpdateConditionDto } from "./dto/condition.dto";

@Controller("conditions")
export class ConditionsController {
  constructor(private readonly conditions: ConditionsService) {}

  @Public()
  @Get()
  list() {
    return this.conditions.listPublic();
  }
}

@Controller("admin/conditions")
export class AdminConditionsController {
  constructor(private readonly conditions: ConditionsService) {}

  @Get()
  list() {
    return this.conditions.listAdmin();
  }

  @Post()
  create(@Body() dto: CreateConditionDto, @Req() request: AuthenticatedRequest) {
    return this.conditions.create(dto, auditContextFrom(request));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateConditionDto, @Req() request: AuthenticatedRequest) {
    return this.conditions.update(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.conditions.remove(id, auditContextFrom(request));
  }
}
