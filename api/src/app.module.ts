import { RoughMaterialsModule } from "./rough-materials/rough-materials.module";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { AuthRateLimitModule } from "./auth/auth-rate-limit.module";
import { AdminGuard } from "./auth/admin.guard";
import { CatalogModule } from "./catalog/catalog.module";
import { ContentModule } from "./content/content.module";
import { CustomersModule } from "./customers/customers.module";
import { DiscountsModule } from "./discounts/discounts.module";
import { EmailModule } from "./email/email.module";
import { HealthModule } from "./health/health.module";
import { GoogleSearchConsoleModule } from "./search-console/google-search-console.module";
import { InboxModule } from "./inbox/inbox.module";
import { LapidaryModule } from "./lapidary/lapidary.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { NewsletterModule } from "./newsletter/newsletter.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { PosModule } from "./pos/pos.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { SettingsModule } from "./settings/settings.module";
import { UploadsModule } from "./uploads/uploads.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuditModule,
    EmailModule,
    AuthRateLimitModule,
    AuthModule,
    CatalogModule,
    RoughMaterialsModule,
    ContentModule,
    CustomersModule,
    DiscountsModule,
    HealthModule,
    GoogleSearchConsoleModule,
    InboxModule,
    LapidaryModule,
    MaintenanceModule,
    NewsletterModule,
    OrdersModule,
    PaymentsModule,
    PosModule,
    ReportsModule,
    ReviewsModule,
    SettingsModule,
    UploadsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
})
export class AppModule {}
