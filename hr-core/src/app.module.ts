import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GovCyPdfHotelsModule } from './gov-cy-pdf-hotels/gov-cy-pdf-hotels.module';
import { RawHotelsModule } from './raw-hotels/raw-hotels.module';

@Module({
  imports: [GovCyPdfHotelsModule, RawHotelsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
