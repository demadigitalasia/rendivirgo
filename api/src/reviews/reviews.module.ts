import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { AdminReviewsController, ProductReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [SettingsModule],
  controllers: [ProductReviewsController, AdminReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
