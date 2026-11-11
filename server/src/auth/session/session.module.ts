import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module.js';
import { SessionController } from './session.controller.js';
import { SessionService } from './session.service.js';

@Module({
  // AuthModule re-exports the Better Auth module, which provides AuthService.
  imports: [AuthModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
