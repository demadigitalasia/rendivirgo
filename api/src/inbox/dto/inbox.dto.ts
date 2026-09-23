import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { MessageStatus } from "../../../generated/prisma";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "0" || value === 0) return false;
  return value;
};

export class CreateMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(2)
  @MaxLength(8000)
  body: string;
}

export class MessageQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;
}

export class UpdateMessageDto {
  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  adminReply?: string;
}

export class ReplyMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  adminReply: string;
}

export class NotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unreadOnly?: boolean;
}
