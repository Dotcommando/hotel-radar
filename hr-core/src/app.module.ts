import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RawHotelsModule } from './raw-hotels/raw-hotels.module';

@Module({
  imports: [RawHotelsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
