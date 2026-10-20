import { Global, Module } from "@nestjs/common";
import { AuthEmailOutboxService } from "./auth-email-outbox.service";
import { EmailService } from "./email.service";

@Global()
@Module({
  providers: [EmailService, AuthEmailOutboxService],
  exports: [EmailService, AuthEmailOutboxService],
})
export class EmailModule {}
