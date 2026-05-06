import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GeoImportsModule } from './geo-imports/geo-imports.module';
import { GovCyPdfHotelsModule } from './gov-cy-pdf-hotels/gov-cy-pdf-hotels.module';
import { HotelProcessingModule } from './hotel-processing/hotel-processing.module';
import { ParsedFilesModule } from './parsed-files/parsed-files.module';
import { RawHotelsModule } from './raw-hotels/raw-hotels.module';

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/hr-core';

@Module({
  imports: [
    MongooseModule.forRoot(MONGODB_URI, {
      lazyConnection: true,
      retryAttempts: 0,
    }),
    GeoImportsModule,
    GovCyPdfHotelsModule,
    HotelProcessingModule,
    ParsedFilesModule,
    RawHotelsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
